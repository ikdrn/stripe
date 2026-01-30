/**
 * Webhookイベントログ
 * 冪等性確保のため、処理済みイベントを記録
 */
export interface WebhookEvent {
  id: string;
  stripeEventId: string;
  eventType: string;
  processedAt: Date;
}

/**
 * Webhookイベントリポジトリインターフェース
 *
 * 設計判断:
 * - Webhookイベントは複数回届く可能性がある
 * - 処理済みイベントを記録し、重複処理を防止
 */
export interface WebhookEventRepository {
  /**
   * イベントが処理済みかチェック
   */
  exists(stripeEventId: string): Promise<boolean>;

  /**
   * イベントを処理済みとして記録
   */
  markAsProcessed(stripeEventId: string, eventType: string): Promise<WebhookEvent>;
}
