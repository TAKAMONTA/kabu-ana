# 購入状態共有システムの動作確認

## 確認項目

1. ✅ Firestoreセキュリティルールが正しく設定されている
2. ✅ Firebase Admin SDKの環境変数が設定されている
3. ✅ Webアプリで購入状態が正しく取得できる
4. ✅ APIエンドポイントが正常に動作する

## 動作確認手順

### 1. 開発サーバーの起動

```bash
npm run dev
```

### 2. ブラウザで確認

1. `http://localhost:3000` にアクセス
2. ログイン（既存アカウントまたは新規登録）
3. ブラウザの開発者ツール（F12）を開く
4. Consoleタブでエラーが出ていないか確認

### 3. Firestoreの確認

Firebase Consoleで以下を確認：

1. Firestore Database → データタブ
2. `subscriptions` コレクションが存在するか確認
3. まだデータがない場合は正常（購入後に作成されます）

### 4. APIエンドポイントのテスト

#### テスト1: 購入状態の確認（GET /api/subscription/check）

**注意**: このAPIはFirebase Auth ID Tokenが必要です。

ブラウザのConsoleで以下を実行：

```javascript
// 1. Firebase Auth ID Tokenを取得
const user = firebase.auth().currentUser;
const idToken = await user.getIdToken();

// 2. APIを呼び出す
const response = await fetch(`/api/subscription/check?idToken=${idToken}`);
const data = await response.json();
console.log("購入状態:", data);
```

**期待される結果:**
```json
{
  "hasSubscription": false,
  "subscription": null,
  "isPremium": false
}
```

（まだ購入していない場合）

#### テスト2: 購入状態の更新（POST /api/subscription/update）

**注意**: このAPIは通常、Android版から呼び出されます。テスト用に手動で呼び出す場合は、正しいパラメータが必要です。

```javascript
const user = firebase.auth().currentUser;
const idToken = await user.getIdToken();

const response = await fetch('/api/subscription/update', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    idToken: idToken,
    status: 'active',
    platform: 'android',
    productId: 'premium_monthly',
    purchaseToken: 'test_token_123',
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30日後
    isTrial: false
  })
});

const data = await response.json();
console.log("更新結果:", data);
```

**期待される結果:**
```json
{
  "success": true,
  "message": "購入状態を更新しました"
}
```

### 5. Webアプリでの確認

メインページに `SubscriptionStatus` コンポーネントを追加して確認できます。

## トラブルシューティング

### エラー: "FIREBASE_SERVICE_ACCOUNT_KEY環境変数が設定されていません"

- `.env.local` に `FIREBASE_SERVICE_ACCOUNT_KEY` が正しく設定されているか確認
- 開発サーバーを再起動

### エラー: "Firebase Admin SDKの初期化に失敗しました"

- `FIREBASE_SERVICE_ACCOUNT_KEY` のJSON形式が正しいか確認
- JSONが1行の文字列として設定されているか確認
- シングルクォート（'）で囲まれているか確認

### エラー: "Missing or insufficient permissions"

- Firestoreのセキュリティルールが正しく設定されているか確認
- ルールを公開したか確認
- ユーザーがログインしているか確認

### エラー: "認証に失敗しました"

- Firebase Auth ID Tokenが有効か確認
- トークンの有効期限（1時間）を確認
- 必要に応じてトークンを再取得

## 次のステップ

動作確認が完了したら：

1. ✅ Android版での実装（購入成功時にAPIを呼び出す）
2. ✅ Lemon Squeezyの実装（Web版の課金機能）
3. ✅ 購入状態を表示するUIの追加

