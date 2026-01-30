import type {
  SubscriptionGateway,
  SubscriptionResult,
  CreateSubscriptionParams,
} from '../../domain/gateways/subscription.gateway.js';
import { getStripeClient } from './client.js';
import { handleStripeError } from '../../shared/errors/payment.error.js';

/**
 * Stripe SubscriptionGateway 実装
 */
export class StripeSubscriptionGateway implements SubscriptionGateway {
  async createSubscription(params: CreateSubscriptionParams): Promise<SubscriptionResult> {
    const stripe = getStripeClient();

    try {
      const subscription = await stripe.subscriptions.create(
        {
          customer: params.customerId,
          items: [{ price: params.priceId }],
          metadata: params.metadata,
          // payment_behavior: 'default_incomplete' を使用
          // これにより、初回決済が必要な場合に PaymentIntent が作成される
          // クライアントで決済確定後、Webhookで状態が更新される
          payment_behavior: 'default_incomplete',
          payment_settings: {
            save_default_payment_method: 'on_subscription',
          },
          // expand で latest_invoice.payment_intent を取得
          // これにより、初回決済用の client_secret を取得可能
          expand: ['latest_invoice.payment_intent'],
        },
        {
          idempotencyKey: params.idempotencyKey,
        }
      );

      return this.toSubscriptionResult(subscription);
    } catch (error) {
      throw handleStripeError(error);
    }
  }

  async retrieveSubscription(subscriptionId: string): Promise<SubscriptionResult> {
    const stripe = getStripeClient();

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice.payment_intent'],
      });
      return this.toSubscriptionResult(subscription);
    } catch (error) {
      throw handleStripeError(error);
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    atPeriodEnd: boolean
  ): Promise<SubscriptionResult> {
    const stripe = getStripeClient();

    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: atPeriodEnd,
      });
      return this.toSubscriptionResult(subscription);
    } catch (error) {
      throw handleStripeError(error);
    }
  }

  async cancelSubscriptionImmediately(subscriptionId: string): Promise<SubscriptionResult> {
    const stripe = getStripeClient();

    try {
      const subscription = await stripe.subscriptions.cancel(subscriptionId);
      return this.toSubscriptionResult(subscription);
    } catch (error) {
      throw handleStripeError(error);
    }
  }

  /**
   * Stripe Subscription をアプリケーション用の型に変換
   */
  private toSubscriptionResult(subscription: {
    id: string;
    status: string;
    customer: string | { id: string };
    items: { data: Array<{ price: { id: string } }> };
    current_period_start: number;
    current_period_end: number;
    cancel_at_period_end: boolean;
    latest_invoice?: {
      payment_intent?: {
        client_secret: string | null;
      } | string | null;
    } | string | null;
  }): SubscriptionResult {
    // client_secret の取得（expand で取得した場合）
    let clientSecret: string | null = null;
    if (
      subscription.latest_invoice &&
      typeof subscription.latest_invoice === 'object' &&
      subscription.latest_invoice.payment_intent &&
      typeof subscription.latest_invoice.payment_intent === 'object'
    ) {
      clientSecret = subscription.latest_invoice.payment_intent.client_secret;
    }

    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

    const priceId = subscription.items.data[0]?.price.id ?? '';

    return {
      id: subscription.id,
      status: subscription.status,
      customerId,
      priceId,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      clientSecret,
    };
  }
}
