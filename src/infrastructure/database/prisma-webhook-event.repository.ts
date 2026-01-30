import { prisma } from './client.js';
import type {
  WebhookEventRepository,
  WebhookEvent,
} from '../../domain/repositories/webhook-event.repository.js';

/**
 * Prisma を使った WebhookEventRepository 実装
 *
 * 設計判断:
 * - Webhook イベントの重複処理を防止するため、処理済みイベントを記録
 * - stripeEventId をユニークキーとして使用
 */
export class PrismaWebhookEventRepository implements WebhookEventRepository {
  async exists(stripeEventId: string): Promise<boolean> {
    const event = await prisma.webhookEvent.findUnique({
      where: { stripeEventId },
    });

    return event !== null;
  }

  async markAsProcessed(stripeEventId: string, eventType: string): Promise<WebhookEvent> {
    const event = await prisma.webhookEvent.create({
      data: {
        stripeEventId,
        eventType,
      },
    });

    return {
      id: event.id,
      stripeEventId: event.stripeEventId,
      eventType: event.eventType,
      processedAt: event.processedAt,
    };
  }
}
