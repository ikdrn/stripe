import { z } from 'zod';

/**
 * 環境変数のスキーマ定義
 * 起動時にバリデーションし、不正な設定での起動を防止
 */
const envSchema = z.object({
  // Stripe
  STRIPE_SECRET_KEY: z
    .string()
    .min(1, 'STRIPE_SECRET_KEY is required')
    .refine(
      (key) => key.startsWith('sk_test_') || key.startsWith('sk_live_'),
      'STRIPE_SECRET_KEY must start with sk_test_ or sk_live_'
    ),
  STRIPE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'STRIPE_PUBLISHABLE_KEY is required')
    .refine(
      (key) => key.startsWith('pk_test_') || key.startsWith('pk_live_'),
      'STRIPE_PUBLISHABLE_KEY must start with pk_test_ or pk_live_'
    ),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .min(1, 'STRIPE_WEBHOOK_SECRET is required')
    .refine(
      (key) => key.startsWith('whsec_'),
      'STRIPE_WEBHOOK_SECRET must start with whsec_'
    ),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Server
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Logging
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
});

export type Config = z.infer<typeof envSchema>;

/**
 * 環境変数を読み込み、バリデーション
 * 起動時に一度だけ実行される
 */
function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  return result.data;
}

/**
 * グローバル設定オブジェクト
 * 遅延評価でテスト時にモック可能
 */
let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

/**
 * 本番環境かどうかを判定
 */
export function isProduction(): boolean {
  return getConfig().NODE_ENV === 'production';
}

/**
 * テスト用：設定をリセット
 */
export function resetConfig(): void {
  cachedConfig = null;
}
