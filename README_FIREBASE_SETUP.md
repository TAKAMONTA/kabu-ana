# Firebase設定ガイド

## 🔥 Firebase設定手順

### 1. Firebaseコンソールでの設定

1. **Firebaseコンソールにアクセス**
   - https://console.firebase.google.com/
   - Googleアカウントでログイン

2. **プロジェクトの選択**
   - プロジェクトID: `ai-analysis-14efa` を選択

3. **Webアプリの追加**
   - 「プロジェクトの概要」→「Webアプリを追加」
   - アプリ名: `kabu-anal-web`
   - 「Firebase Hostingも設定する」にチェック

4. **設定情報の取得**
   - 表示される設定オブジェクトをコピー

### 2. 環境変数の設定

`.env.local`ファイルに以下の環境変数を追加してください：

```env
# Firebase設定
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ai-analysis-14efa.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ai-analysis-14efa
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ai-analysis-14efa.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

### 3. Firebaseサービスの有効化

#### Authentication（認証）

1. Firebaseコンソール → Authentication
2. 「始める」をクリック
3. 「メール/パスワード」を有効化
4. 「Google」プロバイダーも有効化（オプション）

#### Firestore Database（データベース）

1. Firebaseコンソール → Firestore Database
2. 「データベースを作成」をクリック
3. 「本番環境で開始」を選択
4. リージョン: `asia-northeast1 (Tokyo)` を選択

#### Storage（ファイル保存）

1. Firebaseコンソール → Storage
2. 「始める」をクリック
3. セキュリティルールを設定

### 4. セキュリティルールの設定

#### Firestoreセキュリティルール

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 認証済みユーザーのみアクセス可能
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

#### Storageセキュリティルール

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 🚀 実装可能な機能

### 1. 認証機能

- ユーザー登録・ログイン
- パスワードリセット
- Googleログイン

### 2. ポートフォリオ管理

- ユーザー別のポートフォリオ保存
- リアルタイムデータ同期
- 分析履歴の保存

### 3. データベース機能

- 銘柄情報の保存
- 分析結果の履歴
- ユーザー設定の保存

### 4. ファイル保存

- 分析レポートのPDF保存
- チャート画像の保存

## 📝 次のステップ

1. **Firebaseコンソールで設定を完了**
2. **環境変数を設定**
3. **認証機能の実装**
4. **データベース機能の実装**

設定が完了しましたら、具体的な機能実装に進みます！
