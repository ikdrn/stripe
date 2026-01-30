import { prisma } from './client.js';
import type {
  PaymentRepository,
} from '../../domain/repositories/payment.repository.js';
import type {
  Payment,
  CreatePaymentInput,
  PaymentStatus,
} from '../../domain/entities/payment.entity.js';
import { PaymentStatus as PrismaPaymentStatus } from '@prisma/client';

/**
 * Prisma を使った PaymentRepository 実装
 */
export class PrismaPaymentRepository implements PaymentRepository {
  async create(input: CreatePaymentInput): Promise<Payment> {
    const payment = await prisma.payment.create({
      data: {
        userId: input.userId,
        stripePaymentIntentId: input.stripePaymentIntentId,
        amount: input.amount,
        currency: input.currency,
        productId: input.productId ?? null,
        metadata: input.metadata ?? null,
        status: PrismaPaymentStatus.PENDING,
      },
    });

    return this.toDomain(payment);
  }

  async findById(id: string): Promise<Payment | null> {
    const payment = await prisma.payment.findUnique({
      where: { id },
    });

    return payment ? this.toDomain(payment) : null;
  }

  async findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<Payment | null> {
    const payment = await prisma.payment.findUnique({
      where: { stripePaymentIntentId },
    });

    return payment ? this.toDomain(payment) : null;
  }

  async findByUserId(userId: string): Promise<Payment[]> {
    const payments = await prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => this.toDomain(p));
  }

  async updateStatus(id: string, status: PaymentStatus): Promise<Payment> {
    const payment = await prisma.payment.update({
      where: { id },
      data: { status: this.toPrismaStatus(status) },
    });

    return this.toDomain(payment);
  }

  async updateStatusByStripeId(
    stripePaymentIntentId: string,
    status: PaymentStatus
  ): Promise<Payment> {
    const payment = await prisma.payment.update({
      where: { stripePaymentIntentId },
      data: { status: this.toPrismaStatus(status) },
    });

    return this.toDomain(payment);
  }

  async findStalePayments(olderThan: Date): Promise<Payment[]> {
    const payments = await prisma.payment.findMany({
      where: {
        status: {
          in: [
            PrismaPaymentStatus.PENDING,
            PrismaPaymentStatus.PROCESSING,
            PrismaPaymentStatus.REQUIRES_ACTION,
          ],
        },
        createdAt: { lt: olderThan },
      },
    });

    return payments.map((p) => this.toDomain(p));
  }

  /**
   * Prisma の Payment を Domain の Payment に変換
   */
  private toDomain(payment: {
    id: string;
    userId: string;
    stripePaymentIntentId: string;
    amount: number;
    currency: string;
    status: PrismaPaymentStatus;
    productId: string | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): Payment {
    return {
      id: payment.id,
      userId: payment.userId,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      amount: payment.amount,
      currency: payment.currency,
      status: this.toStatus(payment.status),
      productId: payment.productId,
      metadata: payment.metadata as Record<string, string> | null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  /**
   * Prisma の PaymentStatus を Domain の PaymentStatus に変換
   */
  private toStatus(status: PrismaPaymentStatus): PaymentStatus {
    const statusMap: Record<PrismaPaymentStatus, PaymentStatus> = {
      [PrismaPaymentStatus.PENDING]: 'pending',
      [PrismaPaymentStatus.REQUIRES_PAYMENT_METHOD]: 'requires_payment_method',
      [PrismaPaymentStatus.REQUIRES_CONFIRMATION]: 'requires_confirmation',
      [PrismaPaymentStatus.REQUIRES_ACTION]: 'requires_action',
      [PrismaPaymentStatus.PROCESSING]: 'processing',
      [PrismaPaymentStatus.SUCCEEDED]: 'succeeded',
      [PrismaPaymentStatus.CANCELED]: 'canceled',
      [PrismaPaymentStatus.FAILED]: 'failed',
    };

    return statusMap[status];
  }

  /**
   * Domain の PaymentStatus を Prisma の PaymentStatus に変換
   */
  private toPrismaStatus(status: PaymentStatus): PrismaPaymentStatus {
    const statusMap: Record<PaymentStatus, PrismaPaymentStatus> = {
      pending: PrismaPaymentStatus.PENDING,
      requires_payment_method: PrismaPaymentStatus.REQUIRES_PAYMENT_METHOD,
      requires_confirmation: PrismaPaymentStatus.REQUIRES_CONFIRMATION,
      requires_action: PrismaPaymentStatus.REQUIRES_ACTION,
      processing: PrismaPaymentStatus.PROCESSING,
      succeeded: PrismaPaymentStatus.SUCCEEDED,
      canceled: PrismaPaymentStatus.CANCELED,
      failed: PrismaPaymentStatus.FAILED,
    };

    return statusMap[status];
  }
}
