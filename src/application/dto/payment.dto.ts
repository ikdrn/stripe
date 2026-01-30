import { z } from 'zod';

/**
 * 決済開始リクエストDTO
 *
 * 設計判断:
 * - 金額はクライアントから受け取らない（改ざん防止）
 * - productId からサーバー側で金額を決定する
 */
export const initiatePaymentSchema = z.object({
  userId: z.string().uuid(),
  productId: z.string().min(1),
  /** リトライ時に同じキーを使用するため、オプショナル */
  idempotencyKey: z.string().optional(),
});

export type InitiatePaymentDto = z.infer<typeof initiatePaymentSchema>;

/**
 * 決済開始レスポンス
 */
export interface PaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
}

/**
 * 決済履歴レスポンス
 */
export interface PaymentHistoryItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  productId: string | null;
  createdAt: string;
}
