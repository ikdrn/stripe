import type Stripe from 'stripe';
import type { PaymentRepository } from '../../domain/repositories/payment.repository.js';
import type { SubscriptionRepository } from '../../domain/repositories/subscription.repository.js';
import type { WebhookEventRepository } from '../../domain/repositories/webhook-event.repository.js';
import { mapStripeStatus } from '../../domain/entities/payment.entity.js';
import { mapStripeSubscriptionStatus } from '../../domain/entities/subscription.entity.js';
import { logPaymentEvent, logPaymentError, getLogger } from '../../shared/utils/logger.js';

const logger = getLogger();

/**
 * Webhook サービス
 *
 * 設計判断:
 * - Webhookイベントを処理し、DBの状態を更新
 * - 冪等性を確保するため、処理済みイベントはスキップ
 * - 各イベントを独立して処理可能な設計（イベント順序に依存しない）
 */
export class WebhookService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly webhookEventRepository: WebhookEventRepository
  ) {}

  /**
   * Webhook イベントを処理
   */
  async handleEvent(event: Stripe.Event): Promise<void> {
    // 1. 既に処理済みかチェック（冪等性確保）
    const alreadyProcessed = await this.webhookEventRepository.exists(event.id);
    if (alreadyProcessed) {
      logger.info({ eventId: event.id }, 'Event already processed, skipping');
      return;
    }

    logPaymentEvent('webhook_received', {
      stripeEventId: event.id,
      eventType: event.type,
    });

    try {
      // 2. イベント種別に応じて処理を分岐
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.canceled':
          await this.handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
          break;

        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          logger.debug({ eventType: event.type }, 'Unhandled event type');
      }

      // 3. イベントを処理済みとして記録
      await this.webhookEventRepository.markAsProcessed(event.id, event.type);

      logPaymentEvent('webhook_processed', {
        stripeEventId: event.id,
        eventType: event.type,
      });
    } catch (error) {
      logPaymentError('Webhook processing failed', error, {
        stripeEventId: event.id,
        eventType: event.type,
      });
      throw error;
    }
  }

  /**
   * payment_intent.succeeded の処理
   *
   * 重要: この時点でのみサービス提供を開始する
   */
  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.paymentRepository.findByStripePaymentIntentId(paymentIntent.id);

    if (!payment) {
      // サブスクリプションの初回決済の場合、Paymentレコードがない可能性がある
      logger.info(
        { paymentIntentId: paymentIntent.id },
        'Payment not found for succeeded event (may be subscription)'
      );
      return;
    }

    // 既に succeeded の場合はスキップ（冪等）
    if (payment.status === 'succeeded') {
      return;
    }

    await this.paymentRepository.updateStatusByStripeId(paymentIntent.id, 'succeeded');

    logPaymentEvent('succeeded', {
      paymentIntentId: paymentIntent.id,
      userId: payment.userId,
      amount: payment.amount,
    });

    // TODO: ここでサービス提供処理を実行
    // 例: 商品の配送処理、機能のアンロック等
  }

  /**
   * payment_intent.payment_failed の処理
   */
  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.paymentRepository.findByStripePaymentIntentId(paymentIntent.id);

    if (!payment) {
      return;
    }

    await this.paymentRepository.updateStatusByStripeId(paymentIntent.id, 'failed');

    logPaymentEvent('failed', {
      paymentIntentId: paymentIntent.id,
      userId: payment.userId,
      errorCode: paymentIntent.last_payment_error?.code ?? undefined,
    });

    // TODO: ユーザーへの通知処理
  }

  /**
   * payment_intent.canceled の処理
   */
  private async handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.paymentRepository.findByStripePaymentIntentId(paymentIntent.id);

    if (!payment) {
      return;
    }

    await this.paymentRepository.updateStatusByStripeId(paymentIntent.id, 'canceled');
  }

  /**
   * customer.subscription.created の処理
   */
  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    // 通常は createSubscription で既に作成済みだが、
    // Stripe Dashboard から作成された場合などに対応
    const existing = await this.subscriptionRepository.findByStripeSubscriptionId(subscription.id);

    if (existing) {
      // ステータスを更新
      await this.subscriptionRepository.updateStatusByStripeId(
        subscription.id,
        mapStripeSubscriptionStatus(subscription.status)
      );
    }
  }

  /**
   * customer.subscription.updated の処理
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const existing = await this.subscriptionRepository.findByStripeSubscriptionId(subscription.id);

    if (!existing) {
      return;
    }

    // ステータスを更新
    await this.subscriptionRepository.updateStatusByStripeId(
      subscription.id,
      mapStripeSubscriptionStatus(subscription.status)
    );

    // 期間情報を更新
    await this.subscriptionRepository.updatePeriod(
      subscription.id,
      new Date(subscription.current_period_start * 1000),
      new Date(subscription.current_period_end * 1000)
    );

    // キャンセル予約状態を更新
    await this.subscriptionRepository.setCancelAtPeriodEnd(
      subscription.id,
      subscription.cancel_at_period_end
    );

    logger.info(
      { subscriptionId: subscription.id, status: subscription.status },
      'Subscription updated'
    );
  }

  /**
   * customer.subscription.deleted の処理
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const existing = await this.subscriptionRepository.findByStripeSubscriptionId(subscription.id);

    if (!existing) {
      return;
    }

    await this.subscriptionRepository.updateStatusByStripeId(subscription.id, 'canceled');

    logger.info({ subscriptionId: subscription.id }, 'Subscription deleted');

    // TODO: サービス停止処理
  }

  /**
   * invoice.paid の処理
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription || typeof invoice.subscription !== 'string') {
      return;
    }

    const subscription = await this.subscriptionRepository.findByStripeSubscriptionId(
      invoice.subscription
    );

    if (!subscription) {
      return;
    }

    // サブスクリプションをアクティブに更新
    await this.subscriptionRepository.updateStatusByStripeId(invoice.subscription, 'active');

    logger.info(
      { subscriptionId: invoice.subscription, invoiceId: invoice.id },
      'Invoice paid'
    );
  }

  /**
   * invoice.payment_failed の処理
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription || typeof invoice.subscription !== 'string') {
      return;
    }

    logger.warn(
      { subscriptionId: invoice.subscription, invoiceId: invoice.id },
      'Invoice payment failed'
    );

    // TODO: ユーザーへの通知、リトライ案内
  }
}
