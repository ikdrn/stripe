import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { PaymentForm } from './PaymentForm';
import { initiatePayment } from '../api/payment';

// Stripe Publishable Key
// 環境変数から取得（本番では適切に設定）
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_xxxx'
);

interface CheckoutPageProps {
  userId: string;
  productId: string;
  productName: string;
}

/**
 * チェックアウトページ
 *
 * フロー:
 * 1. サーバーに決済開始リクエスト
 * 2. clientSecret を受け取り、Elements に渡す
 * 3. PaymentForm で決済確定
 */
export function CheckoutPage({
  userId,
  productId,
  productName,
}: CheckoutPageProps): JSX.Element {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>('loading');

  useEffect(() => {
    // 決済を開始し、clientSecret を取得
    initiatePayment(userId, productId)
      .then((response) => {
        setClientSecret(response.clientSecret);
        setAmount(response.amount);
        setStatus('ready');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to initialize payment');
        setStatus('error');
      });
  }, [userId, productId]);

  if (status === 'loading') {
    return <div style={styles.container}>Loading...</div>;
  }

  if (status === 'error') {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div style={styles.container}>
        <div style={styles.success}>
          <h2>Payment Successful!</h2>
          <p>Thank you for your purchase.</p>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return <div style={styles.container}>Initializing...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>Checkout</h1>
        <p>{productName}</p>
        {amount && (
          <p style={styles.amount}>
            {new Intl.NumberFormat('ja-JP', {
              style: 'currency',
              currency: 'JPY',
            }).format(amount)}
          </p>
        )}
      </div>

      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: '#5469d4',
            },
          },
        }}
      >
        <PaymentForm
          onSuccess={() => setStatus('success')}
          onError={(msg) => setError(msg)}
        />
      </Elements>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '600px',
    margin: '40px auto',
    padding: '20px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  amount: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#32325d',
  },
  error: {
    backgroundColor: '#fee',
    color: '#c00',
    padding: '16px',
    borderRadius: '4px',
    textAlign: 'center',
  },
  success: {
    backgroundColor: '#efe',
    color: '#060',
    padding: '32px',
    borderRadius: '4px',
    textAlign: 'center',
  },
};
