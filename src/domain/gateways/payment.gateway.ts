/**
 * PaymentIntent 作成結果
 * Stripe の詳細を隠蔽した、アプリケーション用の型
 */
export interface PaymentIntentResult {
  id: string;
  clientSecret: string;
  status: string;
  amount: number;
  currency: string;
}

/**
 * PaymentIntent 作成パラメータ
 */
export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  customerId?: string;
  metadata?: Record<string, string>;
  /** 冪等性確保のため必須 */
  idempotencyKey: string;
}

/**
 * 決済ゲートウェイインターフェース
 *
 * 設計判断:
 * - Stripe SDK への依存を Infrastructure Layer に閉じ込める
 * - Domain/Application Layer は このインターフェースのみに依存
 * - 将来の決済プロバイダ変更（PayPal等）に対応可能
 */
export interface PaymentGateway {
  /**
   * PaymentIntent を作成
   * 注意: この時点では課金されない（意図の作成のみ）
   */
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult>;

  /**
   * PaymentIntent を取得
   */
  retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult>;

  /**
   * PaymentIntent をキャンセル
   */
  cancelPaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult>;
}
