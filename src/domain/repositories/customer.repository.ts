import type { Customer, CreateCustomerInput } from '../entities/customer.entity.js';

/**
 * 顧客リポジトリインターフェース
 */
export interface CustomerRepository {
  /**
   * 顧客を作成
   */
  create(input: CreateCustomerInput): Promise<Customer>;

  /**
   * IDで取得
   */
  findById(id: string): Promise<Customer | null>;

  /**
   * メールアドレスで取得
   */
  findByEmail(email: string): Promise<Customer | null>;

  /**
   * Stripe Customer ID で取得
   */
  findByStripeCustomerId(stripeCustomerId: string): Promise<Customer | null>;

  /**
   * Stripe Customer ID を設定
   */
  setStripeCustomerId(id: string, stripeCustomerId: string): Promise<Customer>;
}
