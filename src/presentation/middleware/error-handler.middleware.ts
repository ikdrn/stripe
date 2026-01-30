import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/index.js';
import { getLogger } from '../../shared/utils/logger.js';

const logger = getLogger();

/**
 * グローバルエラーハンドラー
 *
 * 設計判断:
 * - AppError（操作エラー）とそれ以外（プログラムエラー）を区別
 * - クライアントには適切なエラーレスポンスを返す
 * - 詳細なエラー情報はログに記録し、運用で調査可能に
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 操作エラー（AppError）の場合
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.toJSON(),
    });
    return;
  }

  // プログラムエラー（予期しないエラー）の場合
  logger.error({ err }, 'Unhandled error');

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

/**
 * 404ハンドラー
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
