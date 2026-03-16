# CapacitorアプリでのAPI設定ガイド

## 問題の説明

静的エクスポート（`EXPORT_STATIC=true`）を使用しているため、CapacitorアプリではAPIルートが動作しません。API機能を利用するには、本番環境のAPI URLを設定する必要があります。

## 解決方法

### 1. 本番環境のURLを取得

Vercelなどにデプロイしている場合、本番環境のURLを確認してください。
例: `https://your-app.vercel.app`

### 2. 環境変数を設定

`.env.local`ファイルに以下を追加：

```env
# 本番環境のAPI URL（Capacitorアプリ用）
NEXT_PUBLIC_PRODUCTION_URL=https://your-app.vercel.app
```

または、`NEXT_PUBLIC_API_BASE_URL`を使用：

```env
# APIベースURL（優先的に使用される）
NEXT_PUBLIC_API_BASE_URL=https://your-app.vercel.app
```

### 3. ビルド時に環境変数を設定

ビルド時に環境変数を設定する場合：

```bash
NEXT_PUBLIC_PRODUCTION_URL=https://your-app.vercel.app npm run build:ios
```

### 4. Xcodeで環境変数を設定（オプション）

Xcodeのスキーム設定で環境変数を追加することも可能です。

## 現在の動作

- ✅ 本番URLが設定されている場合: APIが正常に動作
- ⚠️ 本番URLが設定されていない場合: フォールバックデータが使用される

## 注意事項

- 本番URLはHTTPSである必要があります
- CORS設定が正しく行われていることを確認してください
- 環境変数は`NEXT_PUBLIC_`で始まる必要があります（クライアント側で使用するため）

## テスト方法

1. 環境変数を設定
2. アプリを再ビルド
3. 分析ボタンをタップ
4. APIが正常に動作することを確認
