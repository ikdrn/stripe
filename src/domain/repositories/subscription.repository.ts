import type {
  Subscription,
  CreateSubscriptionInput,
  SubscriptionStatus,
} from '../entities/subscription.entity.js';

/**
 * サブスクリプションリポジトリインターフェース
 */
export interface SubscriptionRepository {
  /**
   * サブスクリプションを保存
   */
  create(input: CreateSubscriptionInput): Promise<Subscription>;

  /**
   * IDで取得
   */
  findById(id: string): Promise<Subscription | null>;

  /**
   * Stripe Subscription ID で取得
   */
  findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null>;

  /**
   * ユーザーIDで取得（複数）
   */
  findByUserId(userId: string): Promise<Subscription[]>;

  /**
   * ユーザーのアクティブなサブスクリプションを取得
   */
  findActiveByUserId(userId: string): Promise<Subscription | null>;

  /**
   * ステータスを更新
   */
  updateStatus(id: string, status: SubscriptionStatus): Promise<Subscription>;

  /**
   * Stripe Subscription ID でステータスを更新
   */
  updateStatusByStripeId(
    stripeSubscriptionId: string,
    status: SubscriptionStatus
  ): Promise<Subscription>;

  /**
   * 期間情報を更新
   */
  updatePeriod(
    stripeSubscriptionId: string,
    currentPeriodStart: Date,
    currentPeriodEnd: Date
  ): Promise<Subscription>;

  /**
   * キャンセル予約を設定
   */
  setCancelAtPeriodEnd(stripeSubscriptionId: string, cancelAtPeriodEnd: boolean): Promise<Subscription>;
}
