import { PrismaClient } from '@prisma/client';

/**
 * Prisma クライアントのシングルトン
 *
 * 設計判断:
 * - PrismaClient は内部で接続プーリングを行うため、シングルトンが効率的
 * - 開発時のホットリロードでも接続が増えすぎないよう、グローバル変数で管理
 */

// 開発時のホットリロード対策
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * データベース接続を閉じる
 * アプリケーション終了時に呼び出す
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
