import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../../application/services/payment.service.js';
import { initiatePaymentSchema } from '../../application/dto/payment.dto.js';
import { ValidationError } from '../../shared/errors/index.js';
import { StripePaymentGateway } from '../../infrastructure/stripe/stripe-payment.gateway.js';
import { StripeCustomerGateway } from '../../infrastructure/stripe/stripe-customer.gateway.js';
import { PrismaPaymentRepository } from '../../infrastructure/database/prisma-payment.repository.js';
import { PrismaCustomerRepository } from '../../infrastructure/database/prisma-customer.repository.js';

const router = Router();

// 依存性の注入（本番では DI コンテナを使用）
const paymentService = new PaymentService(
  new StripePaymentGateway(),
  new StripeCustomerGateway(),
  new PrismaPaymentRepository(),
  new PrismaCustomerRepository()
);

/**
 * POST /api/payments
 * 決済を開始する
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = initiatePaymentSchema.safeParse(req.body);

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

    const result = await paymentService.initiatePayment(parseResult.data);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/payments
 * 決済履歴を取得
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.query['userId'] as string;

    if (!userId) {
      throw new ValidationError('userId is required');
    }

    const payments = await paymentService.getPaymentHistory(userId);
    res.json({ payments });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/payments/:paymentIntentId
 * 決済をキャンセル
 */
router.delete('/:paymentIntentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentIntentId } = req.params;
    const userId = req.query['userId'] as string;

    if (!userId) {
      throw new ValidationError('userId is required');
    }

    if (!paymentIntentId) {
      throw new ValidationError('paymentIntentId is required');
    }

    await paymentService.cancelPayment(userId, paymentIntentId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { router as paymentRoutes };
