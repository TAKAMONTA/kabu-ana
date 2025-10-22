# 🔒 セキュリティチェックリスト

## ✅ 環境変数の保護

- [x] `.env.local`ファイルは`.gitignore`に記載済み
- [x] APIキーは環境変数で管理
- [x] Firebase設定は環境変数で管理
- [x] 本番環境と開発環境の分離

## ✅ 認証・認可

- [x] Firebase Authenticationによるユーザー認証
- [x] Googleログイン（OAuth 2.0）実装
- [x] メール/パスワード認証実装
- [x] パスワードリセット機能
- [x] 利用規約・プライバシーポリシーへの同意確認
- [x] 同意記録のFirestore保存

## ✅ データ保護

- [x] Firestoreセキュリティルール設定
- [x] HTTPSによる通信暗号化（Next.js標準）
- [x] ユーザーデータの適切な保存（uid基準）
- [x] タイムスタンプによる操作履歴記録

## ✅ フロントエンドセキュリティ

- [x] 入力値のバリデーション
- [x] エラーメッセージの適切な表示（詳細情報の隠蔽）
- [x] パスワード表示/非表示トグル
- [x] 6文字以上のパスワード強制

## ✅ APIセキュリティ

- [x] API Routeによるサーバーサイド処理
- [x] APIキーの露出防止
- [x] エラーハンドリング実装
- [x] レート制限（Perplexity API側で実装）

## ⚠️ 推奨事項（将来的な実装）

- [ ] reCAPTCHAの実装（ボット対策）
- [ ] 2要素認証（2FA）の実装
- [ ] セッションタイムアウトの実装
- [ ] CSRFトークンの実装
- [ ] 監査ログの実装
- [ ] DDoS対策（Cloudflare等）

## 📝 セキュリティ設定ファイル

### Firebase設定（.env.local）

```
NEXT_PUBLIC_FIREBASE_API_KEY=****
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=****
NEXT_PUBLIC_FIREBASE_PROJECT_ID=****
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=****
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=****
NEXT_PUBLIC_FIREBASE_APP_ID=****
```

### API設定（.env.local）

```
OPENAI_API_KEY=****
PERPLEXITY_API_KEY=****
ALPHA_VANTAGE_API_KEY=****
```

## 🚨 緊急時の対応

1. **APIキー漏洩時**
   - 即座にAPIキーを無効化
   - 新しいAPIキーを発行
   - .env.localを更新
   - Gitリポジトリの履歴確認

2. **不正アクセス検知時**
   - Firebase Consoleで該当ユーザーを無効化
   - Firestoreセキュリティルールの見直し
   - ログの確認と分析

3. **データ漏洩時**
   - 影響範囲の特定
   - ユーザーへの通知
   - 原因の特定と対策

## 最終更新日: 2025年1月2日
