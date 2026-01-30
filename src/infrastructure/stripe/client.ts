import Stripe from 'stripe';
import { getConfig } from '../config/index.js';

/**
 * Stripe クライアントのシングルトン
 *
 * 設計判断:
 * - Stripe SDK は内部で接続プーリングを行うため、シングルトンが効率的
 * - apiVersion は明示的に指定し、予期しない破壊的変更を防止
 */
let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    const config = getConfig();
    stripeClient = new Stripe(config.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    });
  }
  return stripeClient;
}

/**
 * テスト用：クライアントをリセット
 */
export function resetStripeClient(): void {
  stripeClient = null;
}
