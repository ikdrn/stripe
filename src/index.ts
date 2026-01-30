import express from 'express';
import { getConfig } from './infrastructure/config/index.js';
import { getLogger } from './shared/utils/logger.js';
import { disconnectDatabase } from './infrastructure/database/client.js';
import { paymentRoutes } from './presentation/routes/payment.routes.js';
import { subscriptionRoutes } from './presentation/routes/subscription.routes.js';
import { webhookRoutes } from './presentation/routes/webhook.routes.js';
import {
  errorHandler,
  notFoundHandler,
} from './presentation/middleware/error-handler.middleware.js';

const logger = getLogger();

async function main(): Promise<void> {
  const config = getConfig();
  const app = express();

  // Webhook エンドポイントは raw body が必要
  // 他のエンドポイントより先に設定する必要がある
  app.use('/api/webhook', express.raw({ type: 'application/json' }), webhookRoutes);

  // その他のエンドポイントは JSON パース
  app.use(express.json());

  // ヘルスチェック
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // API ルート
  app.use('/api/payments', paymentRoutes);
  app.use('/api/subscriptions', subscriptionRoutes);

  // 404 ハンドラー
  app.use(notFoundHandler);

  // エラーハンドラー
  app.use(errorHandler);

  // サーバー起動
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'Server started');
  });

  // グレースフルシャットダウン
  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down...');

    server.close(async () => {
      await disconnectDatabase();
      logger.info('Server closed');
      process.exit(0);
    });

    // 10秒後に強制終了
    setTimeout(() => {
      logger.error('Forced shutdown');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

main().catch((error) => {
  logger.error({ error }, 'Failed to start server');
  process.exit(1);
});
