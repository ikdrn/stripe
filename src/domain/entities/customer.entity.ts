/**
 * 顧客エンティティ
 *
 * Stripe Customer と1:1で紐づく
 * stripeCustomerId は決済開始時に作成される
 */
export interface Customer {
  id: string;
  email: string;
  stripeCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 顧客作成時の入力
 */
export interface CreateCustomerInput {
  email: string;
  stripeCustomerId?: string;
}

/**
 * Stripe Customer が作成済みかどうかを判定
 */
export function hasStripeCustomer(customer: Customer): boolean {
  return customer.stripeCustomerId !== null;
}
