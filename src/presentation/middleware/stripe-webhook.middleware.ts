import type { Request, Response, NextFunction } from 'express';
import type Stripe from 'stripe';
import { getStripeClient } from '../../infrastructure/stripe/client.js';
import { getConfig } from '../../infrastructure/config/index.js';
import { getLogger } from '../../shared/utils/logger.js';

const logger = getLogger();

/**
 * リクエストに Stripe Event を追加するための型拡張
 */
declare global {
  namespace Express {
    interface Request {
      stripeEvent?: Stripe.Event;
    }
  }
}

/**
 * Webhook署名検証ミドルウェア
 *
 * 設計判断:
 * - 署名検証は必須（偽イベントによる攻撃を防止）
 * - raw body が必要なため、このエンドポイントのみ express.raw() を使用
 * - タイムスタンプも検証し、リプレイ攻撃を防止
 */
export function stripeWebhookMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const stripe = getStripeClient();
  const config = getConfig();

  const signature = req.headers['stripe-signature'];

  if (!signature || typeof signature !== 'string') {
    logger.warn('Webhook received without signature');
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  try {
    // req.body は raw Buffer である必要がある
    const event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      signature,
      config.STRIPE_WEBHOOK_SECRET
    );

    // タイムスタンプ検証（5分以内のイベントのみ受け入れ）
    const tolerance = 300; // 5分
    const now = Math.floor(Date.now() / 1000);

    if (now - event.created > tolerance) {
      logger.warn({ eventId: event.id, created: event.created }, 'Webhook timestamp too old');
      res.status(400).json({ error: 'Webhook timestamp too old' });
      return;
    }

    // 検証済みイベントをリクエストに添付
    req.stripeEvent = event;
    next();
  } catch (err) {
    if (err instanceof Error) {
      logger.error({ error: err.message }, 'Webhook signature verification failed');
    }
    res.status(400).json({ error: 'Invalid signature' });
  }
}
