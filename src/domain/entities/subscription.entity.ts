/**
 * サブスクリプションステータス
 *
 * Stripe Subscription の status に対応
 */
export type SubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

/**
 * サブスクリプションエンティティ
 */
export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * サブスクリプション作成時の入力
 */
export interface CreateSubscriptionInput {
  userId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}

/**
 * サービス利用可能かどうかを判定
 *
 * 設計判断:
 * - active と trialing のみサービス提供可能
 * - past_due は猶予期間として一時的に許可する場合もあるが、
 *   デフォルトでは不可とし、ビジネス要件に応じて変更
 */
export function isSubscriptionActive(subscription: Subscription): boolean {
  return subscription.status === 'active' || subscription.status === 'trialing';
}

/**
 * キャンセル可能かどうかを判定
 */
export function canCancelSubscription(subscription: Subscription): boolean {
  return (
    subscription.status !== 'canceled' &&
    subscription.status !== 'incomplete_expired'
  );
}

/**
 * Stripe Subscription status を内部ステータスに変換
 */
export function mapStripeSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
  const statusMap: Record<string, SubscriptionStatus> = {
    incomplete: 'incomplete',
    incomplete_expired: 'incomplete_expired',
    trialing: 'trialing',
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'unpaid',
    paused: 'paused',
  };

  return statusMap[stripeStatus] ?? 'incomplete';
}
