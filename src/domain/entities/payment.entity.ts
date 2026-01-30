/**
 * 決済ステータス
 *
 * Stripe PaymentIntent の status に対応
 * 自前DBではこれを「キャッシュ」として保持し、Stripeが正
 */
export type PaymentStatus =
  | 'pending'
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'canceled'
  | 'failed';

/**
 * 決済エンティティ
 *
 * ビジネスルール:
 * - succeeded 以外の状態ではサービス提供不可
 * - 金額は必ず正の整数（日本円は小数なし）
 */
export interface Payment {
  id: string;
  userId: string;
  stripePaymentIntentId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  productId: string | null;
  metadata: Record<string, string> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 決済作成時の入力
 */
export interface CreatePaymentInput {
  userId: string;
  stripePaymentIntentId: string;
  amount: number;
  currency: string;
  productId?: string;
  metadata?: Record<string, string>;
}

/**
 * サービス提供可能かどうかを判定
 *
 * 設計判断:
 * この判定はWebhookで succeeded を受信した後にのみ true となる
 * クライアントレスポンスで成功判定してはならない
 */
export function canProvideService(payment: Payment): boolean {
  return payment.status === 'succeeded';
}

/**
 * キャンセル可能かどうかを判定
 */
export function canCancel(payment: Payment): boolean {
  return (
    payment.status !== 'succeeded' &&
    payment.status !== 'canceled' &&
    payment.status !== 'failed'
  );
}

/**
 * Stripe PaymentIntent status を内部ステータスに変換
 */
export function mapStripeStatus(stripeStatus: string): PaymentStatus {
  const statusMap: Record<string, PaymentStatus> = {
    requires_payment_method: 'requires_payment_method',
    requires_confirmation: 'requires_confirmation',
    requires_action: 'requires_action',
    processing: 'processing',
    succeeded: 'succeeded',
    canceled: 'canceled',
    requires_capture: 'processing', // キャプチャ待ちは processing 扱い
  };

  return statusMap[stripeStatus] ?? 'pending';
}
