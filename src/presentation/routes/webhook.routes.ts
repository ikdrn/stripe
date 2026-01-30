import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { stripeWebhookMiddleware } from '../middleware/stripe-webhook.middleware.js';
import { WebhookService } from '../../application/services/webhook.service.js';
import { PrismaPaymentRepository } from '../../infrastructure/database/prisma-payment.repository.js';
import { PrismaSubscriptionRepository } from '../../infrastructure/database/prisma-subscription.repository.js';
import { PrismaWebhookEventRepository } from '../../infrastructure/database/prisma-webhook-event.repository.js';
import { getLogger } from '../../shared/utils/logger.js';

const logger = getLogger();
const router = Router();

// 依存性の注入
const webhookService = new WebhookService(
  new PrismaPaymentRepository(),
  new PrismaSubscriptionRepository(),
  new PrismaWebhookEventRepository()
);

/**
 * POST /api/webhook
 * Stripe Webhook を受信
 *
 * 重要:
 * - このエンドポイントは express.raw() で受け取る必要がある
 * - 署名検証ミドルウェアで検証済みのイベントのみ処理
 */
router.post(
  '/',
  stripeWebhookMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = req.stripeEvent;

      if (!event) {
        // stripeWebhookMiddleware で検証済みなので、ここには来ないはず
        res.status(400).json({ error: 'No event' });
        return;
      }

      // 非同期でイベントを処理
      // Stripe は 20 秒以内に 2xx レスポンスを期待するため、
      // 重い処理がある場合はキューに入れて後で処理することを検討
      await webhookService.handleEvent(event);

      // Stripe に成功を通知
      res.json({ received: true });
    } catch (error) {
      // エラーが発生しても 200 を返すことで、Stripe のリトライに任せる
      // ただし、エラーログは記録
      logger.error({ error }, 'Webhook processing error');

      // 5xx を返すと Stripe がリトライする
      // 意図的にリトライさせたい場合は 5xx を返す
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

export { router as webhookRoutes };
