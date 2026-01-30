import { z } from 'zod';

/**
 * サブスクリプション作成リクエストDTO
 */
export const createSubscriptionSchema = z.object({
  userId: z.string().uuid(),
  priceId: z.string().min(1),
  idempotencyKey: z.string().optional(),
});

export type CreateSubscriptionDto = z.infer<typeof createSubscriptionSchema>;

/**
 * サブスクリプション作成レスポンス
 */
export interface SubscriptionResponse {
  subscriptionId: string;
  status: string;
  /** 初回決済が必要な場合、PaymentIntent の client_secret */
  clientSecret: string | null;
  currentPeriodEnd: string | null;
}

/**
 * サブスクリプションキャンセルリクエストDTO
 */
export const cancelSubscriptionSchema = z.object({
  userId: z.string().uuid(),
  subscriptionId: z.string().min(1),
  /** true の場合、期間終了時にキャンセル */
  atPeriodEnd: z.boolean().default(true),
});

export type CancelSubscriptionDto = z.infer<typeof cancelSubscriptionSchema>;

/**
 * サブスクリプション情報レスポンス
 */
export interface SubscriptionInfoResponse {
  id: string;
  status: string;
  priceId: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}
