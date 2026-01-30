import type {
  CustomerGateway,
  CustomerResult,
  CreateCustomerParams,
} from '../../domain/gateways/customer.gateway.js';
import { getStripeClient } from './client.js';
import { handleStripeError } from '../../shared/errors/payment.error.js';

/**
 * Stripe CustomerGateway 実装
 */
export class StripeCustomerGateway implements CustomerGateway {
  async createCustomer(params: CreateCustomerParams): Promise<CustomerResult> {
    const stripe = getStripeClient();

    try {
      const customer = await stripe.customers.create(
        {
          email: params.email,
          metadata: params.metadata,
        },
        {
          idempotencyKey: params.idempotencyKey,
        }
      );

      return {
        id: customer.id,
        email: customer.email ?? params.email,
      };
    } catch (error) {
      throw handleStripeError(error);
    }
  }

  async retrieveCustomer(customerId: string): Promise<CustomerResult> {
    const stripe = getStripeClient();

    try {
      const customer = await stripe.customers.retrieve(customerId);

      if (customer.deleted) {
        throw new Error('Customer has been deleted');
      }

      return {
        id: customer.id,
        email: customer.email ?? '',
      };
    } catch (error) {
      throw handleStripeError(error);
    }
  }
}
