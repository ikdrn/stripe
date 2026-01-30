import type { PaymentGateway } from '../../domain/gateways/payment.gateway.js';
import type { CustomerGateway } from '../../domain/gateways/customer.gateway.js';
import type { PaymentRepository } from '../../domain/repositories/payment.repository.js';
import type { CustomerRepository } from '../../domain/repositories/customer.repository.js';
import type {
  InitiatePaymentDto,
  PaymentIntentResponse,
  PaymentHistoryItem,
} from '../dto/payment.dto.js';
import { generateIdempotencyKey } from '../../shared/utils/idempotency.js';
import { logPaymentEvent, logPaymentError } from '../../shared/utils/logger.js';
import { NotFoundError, BusinessRuleError } from '../../shared/errors/index.js';
import { mapStripeStatus } from '../../domain/entities/payment.entity.js';

/**
 * 商品マスタ（仮実装）
 * 実際のプロジェクトでは、別途 ProductRepository を作成
 */
const PRODUCTS: Record<string, { price: number; currency: string; name: string }> = {
  prod_basic: { price: 1000, currency: 'jpy', name: 'ベーシックプラン' },
  prod_pro: { price: 3000, currency: 'jpy', name: 'プロプラン' },
  prod_enterprise: { price: 10000, currency: 'jpy', name: 'エンタープライズプラン' },
};

/**
 * 決済サービス
 *
 * 設計判断:
 * - ユースケースの実現を担当
 * - Domain Layer のインターフェースに依存（Infrastructure の具象クラスには依存しない）
 * - トランザクション制御、エラーハンドリングを行う
 */
export class PaymentService {
  constructor(
    private readonly paymentGateway: PaymentGateway,
    private readonly customerGateway: CustomerGateway,
    private readonly paymentRepository: PaymentRepository,
    private readonly customerRepository: CustomerRepository
  ) {}

  /**
   * 決済を開始する
   *
   * フロー:
   * 1. ユーザーの Stripe Customer を取得（なければ作成）
   * 2. 商品情報から金額を取得（クライアントからは受け取らない）
   * 3. PaymentIntent を作成
   * 4. 決済レコードを保存
   * 5. client_secret をクライアントに返す
   */
  async initiatePayment(dto: InitiatePaymentDto): Promise<PaymentIntentResponse> {
    const { userId, productId } = dto;

    // 1. 商品情報を取得（金額はサーバー側で決定）
    const product = PRODUCTS[productId];
    if (!product) {
      throw new NotFoundError('Product', productId);
    }

    // 2. ユーザーの Stripe Customer を取得/作成
    const customer = await this.customerRepository.findById(userId);
    if (!customer) {
      throw new NotFoundError('User', userId);
    }

    let stripeCustomerId = customer.stripeCustomerId;
    if (!stripeCustomerId) {
      const stripeCustomer = await this.customerGateway.createCustomer({
        email: customer.email,
        metadata: { userId },
        idempotencyKey: generateIdempotencyKey({
          userId,
          action: 'create_customer',
          resourceId: userId,
        }),
      });
      stripeCustomerId = stripeCustomer.id;
      await this.customerRepository.setStripeCustomerId(userId, stripeCustomerId);
    }

    // 3. Idempotency Key を生成
    const idempotencyKey =
      dto.idempotencyKey ??
      generateIdempotencyKey({
        userId,
        action: 'create_payment',
        resourceId: productId,
      });

    // 4. PaymentIntent を作成
    const paymentIntent = await this.paymentGateway.createPaymentIntent({
      amount: product.price,
      currency: product.currency,
      customerId: stripeCustomerId,
      metadata: {
        userId,
        productId,
        productName: product.name,
      },
      idempotencyKey,
    });

    // 5. 決済レコードを保存
    await this.paymentRepository.create({
      userId,
      stripePaymentIntentId: paymentIntent.id,
      amount: product.price,
      currency: product.currency,
      productId,
      metadata: { productName: product.name },
    });

    logPaymentEvent('initiated', {
      userId,
      paymentIntentId: paymentIntent.id,
      amount: product.price,
      currency: product.currency,
    });

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.clientSecret,
      amount: product.price,
      currency: product.currency,
    };
  }

  /**
   * 決済履歴を取得
   */
  async getPaymentHistory(userId: string): Promise<PaymentHistoryItem[]> {
    const payments = await this.paymentRepository.findByUserId(userId);

    return payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      productId: p.productId,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  /**
   * 決済をキャンセル
   */
  async cancelPayment(userId: string, paymentIntentId: string): Promise<void> {
    const payment = await this.paymentRepository.findByStripePaymentIntentId(paymentIntentId);

    if (!payment) {
      throw new NotFoundError('Payment', paymentIntentId);
    }

    if (payment.userId !== userId) {
      throw new BusinessRuleError('Cannot cancel payment for another user');
    }

    if (payment.status === 'succeeded') {
      throw new BusinessRuleError('Cannot cancel a succeeded payment');
    }

    if (payment.status === 'canceled') {
      throw new BusinessRuleError('Payment is already canceled');
    }

    try {
      await this.paymentGateway.cancelPaymentIntent(paymentIntentId);
      await this.paymentRepository.updateStatusByStripeId(paymentIntentId, 'canceled');
    } catch (error) {
      logPaymentError('Failed to cancel payment', error, {
        userId,
        paymentIntentId,
      });
      throw error;
    }
  }

  /**
   * Stripe と状態を同期（照合バッチ用）
   */
  async syncPaymentStatus(paymentIntentId: string): Promise<void> {
    const payment = await this.paymentRepository.findByStripePaymentIntentId(paymentIntentId);

    if (!payment) {
      return;
    }

    const stripePaymentIntent = await this.paymentGateway.retrievePaymentIntent(paymentIntentId);
    const newStatus = mapStripeStatus(stripePaymentIntent.status);

    if (payment.status !== newStatus) {
      await this.paymentRepository.updateStatusByStripeId(paymentIntentId, newStatus);
      logPaymentEvent('webhook_processed', {
        paymentIntentId,
        eventType: 'sync',
      });
    }
  }
}
