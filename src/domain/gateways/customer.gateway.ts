/**
 * Stripe Customer 結果
 */
export interface CustomerResult {
  id: string;
  email: string;
}

/**
 * Customer 作成パラメータ
 */
export interface CreateCustomerParams {
  email: string;
  metadata?: Record<string, string>;
  idempotencyKey: string;
}

/**
 * 顧客ゲートウェイインターフェース
 */
export interface CustomerGateway {
  /**
   * Stripe Customer を作成
   */
  createCustomer(params: CreateCustomerParams): Promise<CustomerResult>;

  /**
   * Stripe Customer を取得
   */
  retrieveCustomer(customerId: string): Promise<CustomerResult>;
}
