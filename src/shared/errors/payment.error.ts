import Stripe from 'stripe';
import { AppError } from './base.error.js';

/**
 * 決済エラーの種別
 * Stripeの詳細を隠蔽し、アプリケーションで扱いやすい形に変換
 */
export type PaymentErrorType =
  | 'CARD_DECLINED'
  | 'CARD_EXPIRED'
  | 'CARD_INVALID'
  | 'INSUFFICIENT_FUNDS'
  | 'PROCESSING_ERROR'
  | 'AUTHENTICATION_REQUIRED'
  | 'RATE_LIMITED'
  | 'SYSTEM_ERROR'
  | 'UNKNOWN';

/**
 * 決済エラー
 */
export class PaymentError extends AppError {
  readonly statusCode = 400;
  readonly code = 'PAYMENT_ERROR';
  readonly type: PaymentErrorType;
  readonly retryable: boolean;
  readonly userAction: string | null;
  readonly stripeCode?: string;
  readonly stripeRequestId?: string;

  constructor(params: {
    type: PaymentErrorType;
    message: string;
    retryable: boolean;
    userAction: string | null;
    stripeCode?: string;
    stripeRequestId?: string;
  }) {
    super(params.message);
    this.type = params.type;
    this.retryable = params.retryable;
    this.userAction = params.userAction;
    this.stripeCode = params.stripeCode;
    this.stripeRequestId = params.stripeRequestId;
  }

  override toJSON(): {
    code: string;
    message: string;
    type: PaymentErrorType;
    retryable: boolean;
    userAction: string | null;
  } {
    return {
      code: this.code,
      message: this.message,
      type: this.type,
      retryable: this.retryable,
      userAction: this.userAction,
    };
  }
}

/**
 * Stripeエラーを PaymentError に変換
 *
 * 設計判断:
 * - Stripeの詳細なエラーコードを、ユーザーが理解できる形に変換
 * - リトライ可能かどうかを明確にし、UXを改善
 * - ログには stripeCode と stripeRequestId を残し、調査可能に
 */
export function handleStripeError(error: unknown): PaymentError {
  // Stripeエラーでない場合
  if (!(error instanceof Stripe.errors.StripeError)) {
    return new PaymentError({
      type: 'UNKNOWN',
      message: 'システムエラーが発生しました',
      retryable: false,
      userAction: 'しばらく時間をおいて再度お試しください',
    });
  }

  const requestId = error.requestId;

  // カードエラー
  if (error instanceof Stripe.errors.StripeCardError) {
    return handleCardError(error, requestId);
  }

  // APIエラー（Stripe側の問題）
  if (error instanceof Stripe.errors.StripeAPIError) {
    return new PaymentError({
      type: 'PROCESSING_ERROR',
      message: '決済処理中にエラーが発生しました',
      retryable: true,
      userAction: '数分後に再度お試しください',
      stripeCode: error.code ?? undefined,
      stripeRequestId: requestId,
    });
  }

  // 接続エラー
  if (error instanceof Stripe.errors.StripeConnectionError) {
    return new PaymentError({
      type: 'PROCESSING_ERROR',
      message: '通信エラーが発生しました',
      retryable: true,
      userAction: 'インターネット接続を確認し、再度お試しください',
      stripeRequestId: requestId,
    });
  }

  // レートリミット
  if (error instanceof Stripe.errors.StripeRateLimitError) {
    return new PaymentError({
      type: 'RATE_LIMITED',
      message: 'アクセスが集中しています',
      retryable: true,
      userAction: 'しばらく時間をおいて再度お試しください',
      stripeRequestId: requestId,
    });
  }

  // 認証エラー（設定ミス）
  if (error instanceof Stripe.errors.StripeAuthenticationError) {
    return new PaymentError({
      type: 'SYSTEM_ERROR',
      message: 'システム設定エラーが発生しました',
      retryable: false,
      userAction: '管理者にお問い合わせください',
      stripeRequestId: requestId,
    });
  }

  // リクエスト不正（バグ）
  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    return new PaymentError({
      type: 'SYSTEM_ERROR',
      message: 'システムエラーが発生しました',
      retryable: false,
      userAction: '管理者にお問い合わせください',
      stripeCode: error.code ?? undefined,
      stripeRequestId: requestId,
    });
  }

  // 未知のStripeエラー
  return new PaymentError({
    type: 'UNKNOWN',
    message: 'エラーが発生しました',
    retryable: false,
    userAction: '管理者にお問い合わせください',
    stripeRequestId: requestId,
  });
}

/**
 * カードエラーの詳細分類
 */
function handleCardError(
  error: Stripe.errors.StripeCardError,
  requestId?: string
): PaymentError {
  const declineCode = error.decline_code;
  const code = error.code;

  if (code === 'card_declined') {
    switch (declineCode) {
      case 'insufficient_funds':
        return new PaymentError({
          type: 'INSUFFICIENT_FUNDS',
          message: '残高が不足しています',
          retryable: false,
          userAction: '別のカードをお試しいただくか、残高をご確認ください',
          stripeCode: declineCode,
          stripeRequestId: requestId,
        });
      case 'lost_card':
      case 'stolen_card':
        return new PaymentError({
          type: 'CARD_DECLINED',
          message: 'このカードはご利用いただけません',
          retryable: false,
          userAction: 'カード会社にお問い合わせください',
          stripeCode: declineCode,
          stripeRequestId: requestId,
        });
      default:
        return new PaymentError({
          type: 'CARD_DECLINED',
          message: 'カードが拒否されました',
          retryable: false,
          userAction: '別のカードをお試しください',
          stripeCode: declineCode,
          stripeRequestId: requestId,
        });
    }
  }

  if (code === 'expired_card') {
    return new PaymentError({
      type: 'CARD_EXPIRED',
      message: 'カードの有効期限が切れています',
      retryable: false,
      userAction: '有効なカードをご登録ください',
      stripeCode: code,
      stripeRequestId: requestId,
    });
  }

  if (code === 'incorrect_cvc' || code === 'invalid_cvc') {
    return new PaymentError({
      type: 'CARD_INVALID',
      message: 'セキュリティコードが正しくありません',
      retryable: false,
      userAction: 'カード裏面のセキュリティコードをご確認ください',
      stripeCode: code,
      stripeRequestId: requestId,
    });
  }

  // その他のカードエラー
  return new PaymentError({
    type: 'CARD_INVALID',
    message: 'カード情報に問題があります',
    retryable: false,
    userAction: 'カード情報をご確認のうえ、再度お試しください',
    stripeCode: code ?? undefined,
    stripeRequestId: requestId,
  });
}
