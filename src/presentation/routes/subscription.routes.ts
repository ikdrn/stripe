import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../../application/services/subscription.service.js';
import {
  createSubscriptionSchema,
  cancelSubscriptionSchema,
} from '../../application/dto/subscription.dto.js';
import { ValidationError } from '../../shared/errors/index.js';
import { StripeSubscriptionGateway } from '../../infrastructure/stripe/stripe-subscription.gateway.js';
import { StripeCustomerGateway } from '../../infrastructure/stripe/stripe-customer.gateway.js';
import { PrismaSubscriptionRepository } from '../../infrastructure/database/prisma-subscription.repository.js';
import { PrismaCustomerRepository } from '../../infrastructure/database/prisma-customer.repository.js';

const router = Router();

// 依存性の注入
const subscriptionService = new SubscriptionService(
  new StripeSubscriptionGateway(),
  new StripeCustomerGateway(),
  new PrismaSubscriptionRepository(),
  new PrismaCustomerRepository()
);

/**
 * POST /api/subscriptions
 * サブスクリプションを作成
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = createSubscriptionSchema.safeParse(req.body);

    if (!parseResult.success) {
      const details: Record<string, string[]> = {};
      for (const error of parseResult.error.errors) {
        const path = error.path.join('.');
        if (!details[path]) {
          details[path] = [];
        }
        details[path].push(error.message);
      }
      throw new ValidationError('Invalid request body', details);
    }

    const result = await subscriptionService.createSubscription(parseResult.data);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscriptions/current
 * 現在のサブスクリプションを取得
 */
router.get('/current', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.query['userId'] as string;

    if (!userId) {
      throw new ValidationError('userId is required');
    }

    const subscription = await subscriptionService.getSubscription(userId);
    res.json({ subscription });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscriptions/history
 * サブスクリプション履歴を取得
 */
router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.query['userId'] as string;

    if (!userId) {
      throw new ValidationError('userId is required');
    }

    const subscriptions = await subscriptionService.getSubscriptionHistory(userId);
    res.json({ subscriptions });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/subscriptions/:subscriptionId
 * サブスクリプションをキャンセル
 */
router.delete('/:subscriptionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.query['userId'] as string;
    const atPeriodEnd = req.query['atPeriodEnd'] !== 'false'; // デフォルトは true

    const parseResult = cancelSubscriptionSchema.safeParse({
      userId,
      subscriptionId,
      atPeriodEnd,
    });

    if (!parseResult.success) {
      throw new ValidationError('Invalid request');
    }

    await subscriptionService.cancelSubscription(parseResult.data);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { router as subscriptionRoutes };
