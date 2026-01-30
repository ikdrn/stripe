import type { SubscriptionGateway } from '../../domain/gateways/subscription.gateway.js';
import type { CustomerGateway } from '../../domain/gateways/customer.gateway.js';
import type { SubscriptionRepository } from '../../domain/repositories/subscription.repository.js';
import type { CustomerRepository } from '../../domain/repositories/customer.repository.js';
import type {
  CreateSubscriptionDto,
  SubscriptionResponse,
  CancelSubscriptionDto,
  SubscriptionInfoResponse,
} from '../dto/subscription.dto.js';
import { generateIdempotencyKey } from '../../shared/utils/idempotency.js';
import { getLogger } from '../../shared/utils/logger.js';
import { NotFoundError, BusinessRuleError } from '../../shared/errors/index.js';
import { mapStripeSubscriptionStatus } from '../../domain/entities/subscription.entity.js';

const logger = getLogger();

/**
 * サブスクリプションサービス
 */
export class SubscriptionService {
  constructor(
    private readonly subscriptionGateway: SubscriptionGateway,
    private readonly customerGateway: CustomerGateway,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly customerRepository: CustomerRepository
  ) {}

  /**
   * サブスクリプションを作成
   *
   * フロー:
   * 1. ユーザーの Stripe Customer を取得（なければ作成）
   * 2. 既存のアクティブなサブスクリプションがないか確認
   * 3. Stripe Subscription を作成
   * 4. サブスクリプションレコードを保存
   * 5. client_secret（初回決済用）をクライアントに返す
   */
  async createSubscription(dto: CreateSubscriptionDto): Promise<SubscriptionResponse> {
    const { userId, priceId } = dto;

    // 1. ユーザー情報を取得
    const customer = await this.customerRepository.findById(userId);
    if (!customer) {
      throw new NotFoundError('User', userId);
    }

    // 2. 既存のアクティブなサブスクリプションを確認
    const existingSubscription = await this.subscriptionRepository.findActiveByUserId(userId);
    if (existingSubscription) {
      throw new BusinessRuleError('User already has an active subscription');
    }

    // 3. Stripe Customer を取得/作成
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

    // 4. Idempotency Key を生成
    const idempotencyKey =
      dto.idempotencyKey ??
      generateIdempotencyKey({
        userId,
        action: 'create_subscription',
        resourceId: priceId,
      });

    // 5. Stripe Subscription を作成
    const subscription = await this.subscriptionGateway.createSubscription({
      customerId: stripeCustomerId,
      priceId,
      metadata: { userId },
      idempotencyKey,
    });

    // 6. サブスクリプションレコードを保存
    await this.subscriptionRepository.create({
      userId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      status: mapStripeSubscriptionStatus(subscription.status),
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
    });

    logger.info(
      { userId, subscriptionId: subscription.id },
      'Subscription created'
    );

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      clientSecret: subscription.clientSecret,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    };
  }

  /**
   * サブスクリプションをキャンセル
   */
  async cancelSubscription(dto: CancelSubscriptionDto): Promise<void> {
    const { userId, subscriptionId, atPeriodEnd } = dto;

    const subscription =
      await this.subscriptionRepository.findByStripeSubscriptionId(subscriptionId);

    if (!subscription) {
      throw new NotFoundError('Subscription', subscriptionId);
    }

    if (subscription.userId !== userId) {
      throw new BusinessRuleError('Cannot cancel subscription for another user');
    }

    if (subscription.status === 'canceled') {
      throw new BusinessRuleError('Subscription is already canceled');
    }

    if (atPeriodEnd) {
      await this.subscriptionGateway.cancelSubscription(subscriptionId, true);
      await this.subscriptionRepository.setCancelAtPeriodEnd(subscriptionId, true);
    } else {
      await this.subscriptionGateway.cancelSubscriptionImmediately(subscriptionId);
      await this.subscriptionRepository.updateStatusByStripeId(subscriptionId, 'canceled');
    }

    logger.info({ userId, subscriptionId, atPeriodEnd }, 'Subscription canceled');
  }

  /**
   * ユーザーのサブスクリプション情報を取得
   */
  async getSubscription(userId: string): Promise<SubscriptionInfoResponse | null> {
    const subscription = await this.subscriptionRepository.findActiveByUserId(userId);

    if (!subscription) {
      return null;
    }

    return {
      id: subscription.id,
      status: subscription.status,
      priceId: subscription.stripePriceId,
      currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };
  }

  /**
   * サブスクリプション履歴を取得
   */
  async getSubscriptionHistory(userId: string): Promise<SubscriptionInfoResponse[]> {
    const subscriptions = await this.subscriptionRepository.findByUserId(userId);

    return subscriptions.map((s) => ({
      id: s.id,
      status: s.status,
      priceId: s.stripePriceId,
      currentPeriodStart: s.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    }));
  }
}
