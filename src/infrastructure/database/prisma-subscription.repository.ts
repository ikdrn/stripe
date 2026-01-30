import { prisma } from './client.js';
import type { SubscriptionRepository } from '../../domain/repositories/subscription.repository.js';
import type {
  Subscription,
  CreateSubscriptionInput,
  SubscriptionStatus,
} from '../../domain/entities/subscription.entity.js';
import { SubscriptionStatus as PrismaSubscriptionStatus } from '@prisma/client';

/**
 * Prisma を使った SubscriptionRepository 実装
 */
export class PrismaSubscriptionRepository implements SubscriptionRepository {
  async create(input: CreateSubscriptionInput): Promise<Subscription> {
    const subscription = await prisma.subscription.create({
      data: {
        userId: input.userId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripePriceId: input.stripePriceId,
        status: this.toPrismaStatus(input.status),
        currentPeriodStart: input.currentPeriodStart ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
      },
    });

    return this.toDomain(subscription);
  }

  async findById(id: string): Promise<Subscription | null> {
    const subscription = await prisma.subscription.findUnique({
      where: { id },
    });

    return subscription ? this.toDomain(subscription) : null;
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });

    return subscription ? this.toDomain(subscription) : null;
  }

  async findByUserId(userId: string): Promise<Subscription[]> {
    const subscriptions = await prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return subscriptions.map((s) => this.toDomain(s));
  }

  async findActiveByUserId(userId: string): Promise<Subscription | null> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: {
          in: [PrismaSubscriptionStatus.ACTIVE, PrismaSubscriptionStatus.TRIALING],
        },
      },
    });

    return subscription ? this.toDomain(subscription) : null;
  }

  async updateStatus(id: string, status: SubscriptionStatus): Promise<Subscription> {
    const subscription = await prisma.subscription.update({
      where: { id },
      data: { status: this.toPrismaStatus(status) },
    });

    return this.toDomain(subscription);
  }

  async updateStatusByStripeId(
    stripeSubscriptionId: string,
    status: SubscriptionStatus
  ): Promise<Subscription> {
    const subscription = await prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: { status: this.toPrismaStatus(status) },
    });

    return this.toDomain(subscription);
  }

  async updatePeriod(
    stripeSubscriptionId: string,
    currentPeriodStart: Date,
    currentPeriodEnd: Date
  ): Promise<Subscription> {
    const subscription = await prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: { currentPeriodStart, currentPeriodEnd },
    });

    return this.toDomain(subscription);
  }

  async setCancelAtPeriodEnd(
    stripeSubscriptionId: string,
    cancelAtPeriodEnd: boolean
  ): Promise<Subscription> {
    const subscription = await prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: { cancelAtPeriodEnd },
    });

    return this.toDomain(subscription);
  }

  private toDomain(subscription: {
    id: string;
    userId: string;
    stripeSubscriptionId: string;
    stripePriceId: string;
    status: PrismaSubscriptionStatus;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Subscription {
    return {
      id: subscription.id,
      userId: subscription.userId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      stripePriceId: subscription.stripePriceId,
      status: this.toStatus(subscription.status),
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }

  private toStatus(status: PrismaSubscriptionStatus): SubscriptionStatus {
    const statusMap: Record<PrismaSubscriptionStatus, SubscriptionStatus> = {
      [PrismaSubscriptionStatus.INCOMPLETE]: 'incomplete',
      [PrismaSubscriptionStatus.INCOMPLETE_EXPIRED]: 'incomplete_expired',
      [PrismaSubscriptionStatus.TRIALING]: 'trialing',
      [PrismaSubscriptionStatus.ACTIVE]: 'active',
      [PrismaSubscriptionStatus.PAST_DUE]: 'past_due',
      [PrismaSubscriptionStatus.CANCELED]: 'canceled',
      [PrismaSubscriptionStatus.UNPAID]: 'unpaid',
      [PrismaSubscriptionStatus.PAUSED]: 'paused',
    };

    return statusMap[status];
  }

  private toPrismaStatus(status: SubscriptionStatus): PrismaSubscriptionStatus {
    const statusMap: Record<SubscriptionStatus, PrismaSubscriptionStatus> = {
      incomplete: PrismaSubscriptionStatus.INCOMPLETE,
      incomplete_expired: PrismaSubscriptionStatus.INCOMPLETE_EXPIRED,
      trialing: PrismaSubscriptionStatus.TRIALING,
      active: PrismaSubscriptionStatus.ACTIVE,
      past_due: PrismaSubscriptionStatus.PAST_DUE,
      canceled: PrismaSubscriptionStatus.CANCELED,
      unpaid: PrismaSubscriptionStatus.UNPAID,
      paused: PrismaSubscriptionStatus.PAUSED,
    };

    return statusMap[status];
  }
}
