# 購入状態共有システムのセットアップ

Android版とWeb版で購入状態を共有するためのシステムです。

## アーキテクチャ

```
┌─────────────────────────────────────────────────┐
│                  Firebase Auth                   │
│              （ユーザー認証を共通化）              │
└─────────────────────────────────────────────────┘
          │                           │
          ▼                           ▼
┌──────────────────┐      ┌──────────────────────┐
│   Android版       │      │      Web版            │
│   Google Play     │      │   Lemon Squeezy      │
│   Billing         │      │   (今後実装)         │
└──────────────────┘      └──────────────────────┘
          │                           │
          └───────────┬───────────────┘
                      ▼
         ┌─────────────────────────┐
         │   Firestore             │
         │   (購入状態を保存)        │
         │   - subscriptions/{uid} │
         └─────────────────────────┘
```

## セットアップ手順

### 1. Firebase Admin SDKの設定

Firebase Consoleからサービスアカウントキーを取得します：

1. Firebase Console → プロジェクトの設定 → サービスアカウント
2. 「新しい秘密鍵の生成」をクリック
3. ダウンロードしたJSONファイルの内容を環境変数に設定

### 2. 環境変数の設定

`.env.local` に以下を追加：

```env
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

**重要**: JSON全体を1行の文字列として設定してください。

### 3. Firestoreのセキュリティルール

Firestoreのセキュリティルールを設定します：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 購入状態のコレクション
    match /subscriptions/{userId} {
      // ユーザーは自分の購入状態のみ読み取り可能
      allow read: if request.auth != null && request.auth.uid == userId;
      // 書き込みはサーバー側（Admin SDK）のみ
      allow write: if false;
    }
  }
}
```

## Android版での実装

### 購入成功時にFirestoreに保存

```kotlin
// 購入が成功したら、Firebase Auth ID Tokenを取得してAPIを呼び出す
suspend fun updateSubscriptionStatus(
    purchase: Purchase,
    idToken: String
) {
    val requestBody = mapOf(
        "idToken" to idToken,
        "status" to "active",
        "platform" to "android",
        "productId" to purchase.products.first(),
        "purchaseToken" to purchase.purchaseToken,
        "expiryDate" to purchase.expiryTimeMillis?.let { 
            Instant.ofEpochMilli(it).toString() 
        },
        "isTrial" to (purchase.isAutoRenewing && purchase.purchaseState == Purchase.PurchaseState.PURCHASED)
    )
    
    val response = httpClient.post("https://your-domain.com/api/subscription/update") {
        contentType(ContentType.Application.Json)
        setBody(requestBody)
    }
    
    if (response.status.isSuccess()) {
        Log.d("Subscription", "購入状態を更新しました")
    }
}
```

### Firebase Auth ID Tokenの取得

```kotlin
// Firebase AuthからID Tokenを取得
FirebaseAuth.getInstance().currentUser?.getIdToken(false)
    ?.addOnCompleteListener { task ->
        if (task.isSuccessful) {
            val idToken = task.result?.token
            // idTokenを使ってAPIを呼び出す
            updateSubscriptionStatus(purchase, idToken)
        }
    }
```

## Web版での実装

### 購入状態の確認

```typescript
import { useSubscription } from "@/hooks/useSubscription";

function MyComponent() {
  const { subscription, isPremium, loading } = useSubscription();
  
  if (loading) return <div>読み込み中...</div>;
  
  if (isPremium) {
    return <div>プレミアム機能をご利用いただけます</div>;
  }
  
  return <div>プレミアム機能を購入してください</div>;
}
```

### 購入状態の表示

```typescript
import { SubscriptionStatus } from "@/components/SubscriptionStatus";

function SettingsPage() {
  return (
    <div>
      <SubscriptionStatus />
    </div>
  );
}
```

## APIエンドポイント

### POST /api/subscription/update

Android版から購入状態を更新します。

**リクエストボディ:**
```json
{
  "idToken": "Firebase Auth ID Token",
  "status": "active",
  "platform": "android",
  "productId": "premium_monthly",
  "purchaseToken": "Google Play購入トークン",
  "expiryDate": "2024-12-31T23:59:59Z",  // オプション
  "isTrial": false  // オプション
}
```

**レスポンス:**
```json
{
  "success": true,
  "message": "購入状態を更新しました"
}
```

### GET /api/subscription/check

購入状態を確認します（主にサーバー側で使用）。

**クエリパラメータ:**
- `idToken`: Firebase Auth ID Token

**レスポンス:**
```json
{
  "hasSubscription": true,
  "subscription": {
    "userId": "user123",
    "status": "active",
    "platform": "android",
    "productId": "premium_monthly",
    "purchaseDate": "2024-01-01T00:00:00Z",
    "expiryDate": "2024-12-31T23:59:59Z",
    "isTrial": false
  },
  "isPremium": true
}
```

## データ構造

### Firestore: subscriptions/{userId}

```typescript
{
  userId: string;              // Firebase Auth UID
  status: "active" | "expired" | "cancelled" | "pending" | "trial";
  platform: "android" | "web" | "ios";
  productId: string;           // Google Play / Lemon Squeezyの商品ID
  purchaseToken?: string;      // Google Play購入トークン
  orderId?: string;             // Lemon Squeezy注文ID
  purchaseDate: Timestamp;
  expiryDate?: Timestamp;       // サブスクリプションの場合
  isTrial: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## トラブルシューティング

### Firebase Admin SDKの初期化エラー

- `FIREBASE_SERVICE_ACCOUNT_KEY`環境変数が正しく設定されているか確認
- JSONが1行の文字列として設定されているか確認
- Vercelの環境変数設定を確認

### 認証エラー

- Firebase Auth ID Tokenが有効か確認
- トークンの有効期限（1時間）を確認
- 必要に応じてトークンを再取得

### Firestoreの読み取りエラー

- セキュリティルールが正しく設定されているか確認
- ユーザーがログインしているか確認

