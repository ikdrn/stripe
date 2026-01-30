const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface PaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
}

export interface SubscriptionResponse {
  subscriptionId: string;
  status: string;
  clientSecret: string | null;
  currentPeriodEnd: string | null;
}

/**
 * 決済を開始
 *
 * 設計判断:
 * - 金額はサーバー側で決定（productId のみ送信）
 * - clientSecret を受け取り、Stripe.js で決済確定
 */
export async function initiatePayment(
  userId: string,
  productId: string
): Promise<PaymentIntentResponse> {
  const response = await fetch(`${API_BASE_URL}/api/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, productId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to initiate payment');
  }

  return response.json();
}

/**
 * サブスクリプションを作成
 */
export async function createSubscription(
  userId: string,
  priceId: string
): Promise<SubscriptionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, priceId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to create subscription');
  }

  return response.json();
}

/**
 * サブスクリプションをキャンセル
 */
export async function cancelSubscription(
  userId: string,
  subscriptionId: string,
  atPeriodEnd = true
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/subscriptions/${subscriptionId}?userId=${userId}&atPeriodEnd=${atPeriodEnd}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to cancel subscription');
  }
}
