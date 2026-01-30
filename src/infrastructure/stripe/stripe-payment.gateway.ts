import type {
  PaymentGateway,
  PaymentIntentResult,
  CreatePaymentIntentParams,
} from '../../domain/gateways/payment.gateway.js';
import { getStripeClient } from './client.js';
import { handleStripeError } from '../../shared/errors/payment.error.js';

/**
 * Stripe PaymentGateway 実装
 *
 * 設計判断:
 * - Domain Layer の PaymentGateway インターフェースを実装
 * - Stripe SDK の詳細を隠蔽し、アプリケーション用の型に変換
 * - エラーは handleStripeError で統一的に処理
 */
export class StripePaymentGateway implements PaymentGateway {
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    const stripe = getStripeClient();

    try {
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: params.amount,
          currency: params.currency,
          customer: params.customerId,
          metadata: params.metadata,
          // automatic_payment_methods を有効化
          // これにより、Stripe Dashboard で設定した決済手段が自動的に有効になる
          automatic_payment_methods: {
            enabled: true,
          },
        },
        {
          // 冪等性キーを必ず指定
          // これにより、同一リクエストの再送時に二重作成を防止
          idempotencyKey: params.idempotencyKey,
        }
      );

      return this.toPaymentIntentResult(paymentIntent);
    } catch (error) {
      throw handleStripeError(error);
    }
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult> {
    const stripe = getStripeClient();

    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return this.toPaymentIntentResult(paymentIntent);
    } catch (error) {
      throw handleStripeError(error);
    }
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult> {
    const stripe = getStripeClient();

    try {
      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
      return this.toPaymentIntentResult(paymentIntent);
    } catch (error) {
      throw handleStripeError(error);
    }
  }

  /**
   * Stripe PaymentIntent をアプリケーション用の型に変換
   */
  private toPaymentIntentResult(paymentIntent: {
    id: string;
    client_secret: string | null;
    status: string;
    amount: number;
    currency: string;
  }): PaymentIntentResult {
    return {
      id: paymentIntent.id,
      clientSecret: paymentIntent.client_secret ?? '',
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    };
  }
}
