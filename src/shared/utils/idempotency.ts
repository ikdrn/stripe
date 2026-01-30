import { createHash } from 'crypto';

/**
 * Idempotency Key 生成
 *
 * 設計判断:
 * - Stripe APIはIdempotency Keyで同一リクエストの重複実行を防止
 * - 同一操作に対して同じキーを生成することで、リトライ時の二重課金を防止
 * - SHA256ハッシュで推測困難に
 *
 * 使用例:
 * - 決済開始時: generateIdempotencyKey({ userId, action: 'create_payment', resourceId: productId })
 * - サブスク作成時: generateIdempotencyKey({ userId, action: 'create_subscription', resourceId: priceId })
 */
export function generateIdempotencyKey(params: {
  userId: string;
  action: 'create_payment' | 'create_subscription' | 'create_customer';
  resourceId: string;
  /** リトライ時は同じタイムスタンプを使用 */
  timestamp?: number;
}): string {
  const timestamp = params.timestamp ?? Date.now();
  const base = [params.userId, params.action, params.resourceId, timestamp].join(':');

  return createHash('sha256').update(base).digest('hex').slice(0, 32);
}

/**
 * リトライ用のユーティリティ
 * エクスポネンシャルバックオフで再試行
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error) || attempt === maxAttempts) {
        throw error;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
