import type { Payment, CreatePaymentInput, PaymentStatus } from '../entities/payment.entity.js';

/**
 * 決済リポジトリインターフェース
 *
 * 設計判断:
 * - Domain Layer にはインターフェースのみ定義
 * - 実装は Infrastructure Layer (PostgresPaymentRepository) で行う
 * - これにより、DBの変更がDomain/Applicationに影響しない
 */
export interface PaymentRepository {
  /**
   * 決済を保存
   */
  create(input: CreatePaymentInput): Promise<Payment>;

  /**
   * IDで取得
   */
  findById(id: string): Promise<Payment | null>;

  /**
   * Stripe PaymentIntent ID で取得
   */
  findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<Payment | null>;

  /**
   * ユーザーIDで取得（複数）
   */
  findByUserId(userId: string): Promise<Payment[]>;

  /**
   * ステータスを更新
   */
  updateStatus(id: string, status: PaymentStatus): Promise<Payment>;

  /**
   * Stripe PaymentIntent ID でステータスを更新
   */
  updateStatusByStripeId(stripePaymentIntentId: string, status: PaymentStatus): Promise<Payment>;

  /**
   * 古い未完了決済を取得（照合バッチ用）
   */
  findStalePayments(olderThan: Date): Promise<Payment[]>;
}
