# Firestoreセキュリティルール設定ガイド

購入状態共有システム用のFirestoreセキュリティルールを設定します。

## 設定手順

### 1. Firebase Consoleにアクセス

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクトを選択

### 2. Firestore Databaseを開く

1. 左メニューから「**Firestore Database**」をクリック
2. 上部タブから「**ルール**」タブをクリック

### 3. セキュリティルールを設定

既存のルールがある場合とない場合で対応が異なります。

#### 既存のルールがない場合

以下のルールをそのままコピー＆ペーストしてください：

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

#### 既存のルールがある場合

既存のルールに `subscriptions` コレクションのルールを追加してください。

**例：既存のルールがある場合**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 既存のルール（例：ユーザープロファイル）
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // 購入状態のコレクション（新規追加）
    match /subscriptions/{userId} {
      // ユーザーは自分の購入状態のみ読み取り可能
      allow read: if request.auth != null && request.auth.uid == userId;
      // 書き込みはサーバー側（Admin SDK）のみ
      allow write: if false;
    }
  }
}
```

### 4. ルールを公開

1. ルールを入力したら、「**公開**」ボタンをクリック
2. 確認ダイアログで「**公開**」をクリック
3. 数秒で反映されます

## ルールの説明

### `subscriptions/{userId}` コレクション

- **`allow read`**: 
  - ログイン済みユーザー（`request.auth != null`）
  - かつ自分のUIDと一致する場合のみ読み取り可能
  - これにより、ユーザーは自分の購入状態のみ確認できます

- **`allow write: if false`**: 
  - すべての書き込みを禁止
  - 書き込みはFirebase Admin SDK（サーバー側）のみ可能
  - これにより、クライアント側からの不正な書き込みを防止

## 動作確認

### 1. ルールのテスト

Firebase Consoleの「ルール」タブで「**ルールをテスト**」ボタンからテストできます。

**テストケース例：**

```javascript
// テスト1: 自分の購入状態を読み取る（成功するはず）
function test1() {
  return {
    auth: { uid: "user123" },
    path: "/databases/(default)/documents/subscriptions/user123",
    method: "get"
  };
}

// テスト2: 他人の購入状態を読み取る（失敗するはず）
function test2() {
  return {
    auth: { uid: "user123" },
    path: "/databases/(default)/documents/subscriptions/user456",
    method: "get"
  };
}

// テスト3: ログインなしで読み取る（失敗するはず）
function test3() {
  return {
    auth: null,
    path: "/databases/(default)/documents/subscriptions/user123",
    method: "get"
  };
}

// テスト4: 書き込もうとする（失敗するはず）
function test4() {
  return {
    auth: { uid: "user123" },
    path: "/databases/(default)/documents/subscriptions/user123",
    method: "create",
    resource: { data: { status: "active" } }
  };
}
```

### 2. 実際の動作確認

Webアプリでログインして、`useSubscription`フックが正常に動作するか確認：

```typescript
import { useSubscription } from "@/hooks/useSubscription";

function TestComponent() {
  const { subscription, loading, error } = useSubscription();
  
  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラー: {error}</div>;
  
  return <div>購入状態: {subscription ? "あり" : "なし"}</div>;
}
```

## トラブルシューティング

### エラー: "Missing or insufficient permissions"

- ユーザーがログインしているか確認
- ルールが正しく公開されているか確認
- ユーザーのUIDとドキュメントのパスが一致しているか確認

### エラー: "Permission denied"

- `allow write: if false` により、クライアント側からの書き込みは常に拒否されます
- これは正常な動作です（書き込みはAdmin SDK経由のみ）

### ルールが反映されない

- ルールを公開してから数秒待つ
- ブラウザのキャッシュをクリア
- 開発サーバーを再起動

## セキュリティのベストプラクティス

1. **最小権限の原則**: 必要最小限の権限のみ付与
2. **サーバー側での検証**: 重要なデータの書き込みは常にサーバー側で検証
3. **定期的な監査**: ルールを定期的に見直し、不要な権限がないか確認

## 次のステップ

セキュリティルールの設定が完了したら：

1. ✅ 動作確認（Webアプリでログインして購入状態を確認）
2. ✅ Android版での実装（購入成功時にAPIを呼び出す）
3. ✅ Lemon Squeezyの実装（Web版の課金機能）

