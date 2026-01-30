import { prisma } from './client.js';
import type { CustomerRepository } from '../../domain/repositories/customer.repository.js';
import type { Customer, CreateCustomerInput } from '../../domain/entities/customer.entity.js';

/**
 * Prisma を使った CustomerRepository 実装
 */
export class PrismaCustomerRepository implements CustomerRepository {
  async create(input: CreateCustomerInput): Promise<Customer> {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        stripeCustomerId: input.stripeCustomerId ?? null,
      },
    });

    return this.toDomain(user);
  }

  async findById(id: string): Promise<Customer | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    return user ? this.toDomain(user) : null;
  }

  async findByEmail(email: string): Promise<Customer | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    return user ? this.toDomain(user) : null;
  }

  async findByStripeCustomerId(stripeCustomerId: string): Promise<Customer | null> {
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId },
    });

    return user ? this.toDomain(user) : null;
  }

  async setStripeCustomerId(id: string, stripeCustomerId: string): Promise<Customer> {
    const user = await prisma.user.update({
      where: { id },
      data: { stripeCustomerId },
    });

    return this.toDomain(user);
  }

  private toDomain(user: {
    id: string;
    email: string;
    stripeCustomerId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Customer {
    return {
      id: user.id,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
