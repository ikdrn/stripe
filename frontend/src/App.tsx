import { CheckoutPage } from './components/CheckoutPage';

/**
 * サンプルアプリケーション
 *
 * 実際のアプリケーションでは:
 * - ルーティング（React Router等）を使用
 * - 認証状態からユーザーIDを取得
 * - 商品選択画面から商品IDを受け取る
 */
function App(): JSX.Element {
  // サンプル用の固定値
  // 実際のアプリでは認証システムから取得
  const userId = 'sample-user-id';
  const productId = 'prod_basic';
  const productName = 'ベーシックプラン';

  return (
    <div>
      <CheckoutPage
        userId={userId}
        productId={productId}
        productName={productName}
      />
    </div>
  );
}

export default App;
