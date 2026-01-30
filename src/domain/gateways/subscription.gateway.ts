/**
 * サブスクリプション作成結果
 */
export interface SubscriptionResult {
  id: string;
  status: string;
  customerId: string;
  priceId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  /** 初回決済が必要な場合、PaymentIntent の client_secret */
  clientSecret: string | null;
}

/**
 * サブスクリプション作成パラメータ
 */
export interface CreateSubscriptionParams {
  customerId: string;
  priceId: string;
  metadata?: Record<string, string>;
  idempotencyKey: string;
}

/**
 * サブスクリプションゲートウェイインターフェース
 */
export interface SubscriptionGateway {
  /**
   * サブスクリプションを作成
   *
   * 設計判断:
   * - payment_behavior: 'default_incomplete' を使用
   * - 初回決済が必要な場合、clientSecret が返される
   * - クライアントで決済確定後、Webhookで状態が更新される
   */
  createSubscription(params: CreateSubscriptionParams): Promise<SubscriptionResult>;

  /**
   * サブスクリプションを取得
   */
  retrieveSubscription(subscriptionId: string): Promise<SubscriptionResult>;

  /**
   * サブスクリプションをキャンセル
   * @param atPeriodEnd true の場合、期間終了時にキャンセル
   */
  cancelSubscription(subscriptionId: string, atPeriodEnd: boolean): Promise<SubscriptionResult>;

  /**
   * サブスクリプションを即時キャンセル
   */
  cancelSubscriptionImmediately(subscriptionId: string): Promise<SubscriptionResult>;
}
