import pino from 'pino';
import { getConfig, isProduction } from '../../infrastructure/config/index.js';

/**
 * 構造化ロガー
 *
 * 設計判断:
 * - pino を採用（高速、構造化ログ）
 * - 開発時は pino-pretty で整形
 * - 本番時はJSON形式（ログ分析ツールで解析可能）
 */
function createLogger(): pino.Logger {
  const config = getConfig();

  const options: pino.LoggerOptions = {
    level: config.LOG_LEVEL,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  // 開発時は見やすく整形
  if (!isProduction()) {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(options);
}

// シングルトン
let loggerInstance: pino.Logger | null = null;

export function getLogger(): pino.Logger {
  if (!loggerInstance) {
    loggerInstance = createLogger();
  }
  return loggerInstance;
}

/**
 * 決済イベント専用ログ
 * 監査・調査用に構造化された形式で記録
 */
export interface PaymentLogContext {
  userId?: string;
  paymentIntentId?: string;
  subscriptionId?: string;
  amount?: number;
  currency?: string;
  eventType?: string;
  stripeEventId?: string;
  errorCode?: string;
}

export function logPaymentEvent(
  event: 'initiated' | 'succeeded' | 'failed' | 'webhook_received' | 'webhook_processed',
  context: PaymentLogContext
): void {
  const logger = getLogger();
  logger.info({ event: `payment.${event}`, ...context }, `Payment ${event}`);
}

export function logPaymentError(
  message: string,
  error: unknown,
  context: PaymentLogContext
): void {
  const logger = getLogger();
  logger.error(
    {
      event: 'payment.error',
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      ...context,
    },
    message
  );
}
