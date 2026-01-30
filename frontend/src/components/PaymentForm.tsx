import { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

interface PaymentFormProps {
  onSuccess: () => void;
  onError: (message: string) => void;
}

/**
 * 決済フォームコンポーネント
 *
 * 設計判断:
 * - Payment Element を使用（カード以外の決済手段にも対応）
 * - 決済確定は confirmPayment で行う
 * - 成功判定はクライアントで行わず、Webhook でサーバーが行う
 *   （ここでは楽観的 UI として成功画面を表示）
 */
export function PaymentForm({ onSuccess, onError }: PaymentFormProps): JSX.Element {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    // 決済を確定
    // この時点で 3D セキュア認証が必要な場合、自動的にモーダルが表示される
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // 決済完了後のリダイレクト先
        // 本番では適切な URL を設定
        return_url: `${window.location.origin}/payment/complete`,
      },
      // リダイレクトせずに結果を受け取る場合
      redirect: 'if_required',
    });

    if (error) {
      // エラーメッセージを表示
      setMessage(error.message ?? 'An unexpected error occurred.');
      onError(error.message ?? 'Payment failed');
      setIsProcessing(false);
      return;
    }

    // 決済成功（楽観的 UI）
    // 注意: 最終的な成功判定は Webhook で行う
    if (paymentIntent?.status === 'succeeded') {
      onSuccess();
    } else if (paymentIntent?.status === 'processing') {
      setMessage('Payment is processing. You will be notified when complete.');
    } else if (paymentIntent?.status === 'requires_action') {
      // 3D セキュア等の追加認証が必要
      // Stripe.js が自動的に処理する
      setMessage('Additional authentication required.');
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <PaymentElement />

      {message && <div style={styles.message}>{message}</div>}

      <button
        type="submit"
        disabled={!stripe || isProcessing}
        style={{
          ...styles.button,
          opacity: !stripe || isProcessing ? 0.5 : 1,
        }}
      >
        {isProcessing ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    maxWidth: '400px',
    margin: '0 auto',
  },
  button: {
    backgroundColor: '#5469d4',
    color: '#ffffff',
    padding: '12px 16px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  message: {
    color: '#697386',
    fontSize: '14px',
    textAlign: 'center',
  },
};
