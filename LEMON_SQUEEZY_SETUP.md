# Lemon Squeezy セットアップガイド

Web版の課金機能をLemon Squeezyで実装するためのガイドです。

## 1. Lemon Squeezyアカウントの作成

### 1.1 アカウント登録

1. [Lemon Squeezy](https://www.lemonsqueezy.com/) にアクセス
2. 「Get Started」をクリック
3. メールアドレスとパスワードでアカウントを作成
4. メール認証を完了

### 1.2 ストアの設定

1. ダッシュボードでストア名を設定
2. 「Settings」→「Store」で以下を設定：
   - Store name: AI Market Analyzer
   - Currency: JPY（日本円）
   - Support email: サポート用メールアドレス

### 1.3 商品の登録

1. 「Products」→「+ New Product」をクリック
2. 商品情報を入力：
   - **Name**: プレミアムプラン
   - **Description**: AI株式分析の全機能が利用可能
   - **Pricing**: 
     - 月額プラン: ¥980/月（Subscription）
     - または 年額プラン: ¥9,800/年（Subscription）
3. 「Publish」で公開

## 2. APIキーとWebhookの設定

### 2.1 APIキーの取得

1. 「Settings」→「API」をクリック
2. 「+ New API Key」をクリック
3. キーに名前をつけて作成（例: "AI Market Analyzer Production"）
4. 表示されたAPIキーをコピー（一度しか表示されません）

### 2.2 Webhookの設定

1. 「Settings」→「Webhooks」をクリック
2. 「+ New Webhook」をクリック
3. 以下を設定：
   - **URL**: `https://あなたのドメイン/api/lemon-squeezy/webhook`
   - **Events**: 
     - ✅ `subscription_created`
     - ✅ `subscription_updated`
     - ✅ `subscription_cancelled`
     - ✅ `subscription_payment_success`
     - ✅ `order_created`
4. 「Save Webhook」をクリック
5. 表示された「Signing Secret」をコピー

## 3. 環境変数の設定

`.env.local` に以下を追加：

```env
# Lemon Squeezy Configuration
LEMON_SQUEEZY_API_KEY=your_api_key_here
LEMON_SQUEEZY_WEBHOOK_SECRET=your_webhook_secret_here
LEMON_SQUEEZY_STORE_ID=your_store_id_here
LEMON_SQUEEZY_PRODUCT_ID=your_product_id_here
LEMON_SQUEEZY_VARIANT_ID=your_variant_id_here
```

### 各値の取得方法

- **LEMON_SQUEEZY_API_KEY**: Settings → API で取得
- **LEMON_SQUEEZY_WEBHOOK_SECRET**: Settings → Webhooks で取得
- **LEMON_SQUEEZY_STORE_ID**: ダッシュボードのURLから確認（`app.lemonsqueezy.com/stores/xxxxx`）
- **LEMON_SQUEEZY_PRODUCT_ID**: Products → 商品を選択 → URLから確認
- **LEMON_SQUEEZY_VARIANT_ID**: Products → 商品 → Variants から確認

## 4. Vercel環境変数の設定

1. Vercelダッシュボード → プロジェクト設定 → Environment Variables
2. 上記の環境変数をすべて追加
3. 再デプロイ

## 5. テストモードでの確認

### 5.1 テストカードの使用

Lemon Squeezyのテストモードでは、以下のテストカードが使用できます：

- **成功**: 4242 4242 4242 4242
- **失敗**: 4000 0000 0000 0002

有効期限: 任意の未来の日付
CVC: 任意の3桁

### 5.2 テスト購入の流れ

1. Webアプリで「購入する」ボタンをクリック
2. Lemon Squeezyのチェックアウトページに遷移
3. テストカードで購入
4. 購入完了後、アプリに戻る
5. プレミアム機能が有効化されることを確認

## 6. 本番運用

### 6.1 テストモードから本番モードへ

1. Lemon Squeezy ダッシュボード → Settings → General
2. 「Live Mode」を有効化
3. 本番用のWebhook URLを設定
4. 本番用のAPIキーを取得して環境変数を更新

### 6.2 注意事項

- 本番環境では必ずHTTPSを使用
- Webhook署名の検証を必ず実装（セキュリティ対策）
- エラーログを監視

## 7. トラブルシューティング

### Webhookが届かない

1. Webhook URLが正しいか確認
2. サーバーがHTTPSで公開されているか確認
3. Lemon Squeezy ダッシュボードのWebhookログを確認

### 購入状態が更新されない

1. Firebase Admin SDKが正しく設定されているか確認
2. Firestoreのセキュリティルールを確認
3. サーバーログでエラーを確認

### チェックアウトページに遷移しない

1. APIキーが正しいか確認
2. Store ID、Product ID、Variant IDが正しいか確認
3. ブラウザのコンソールでエラーを確認

