# Firestoreセキュリティルール設定ガイド

現在のアプリ構成（サブスク + 使用量制限 + ウォッチリスト + 通知）に対応した
Firestoreルールの設定手順です。

## 対象コレクション

- `subscriptions/{userId}`: 購入状態（読み取りのみ）
- `usage/{userId}`: 使用回数管理（本人のみ読み書き）
- `users/{userId}/watchlist/{itemId}`: ウォッチリスト（本人のみ読み書き）
- `users/{userId}/alerts/{alertId}`: 通知履歴（本人のみ読み書き）
- `users/{userId}/preferences/{prefId}`: 通知設定など（本人のみ読み書き）

## 反映するルールファイル

このリポジトリでは `firestore.rules` を利用します。

```bash
firebase deploy --only firestore:rules
```

## ルールの要点

- 認証済みかつ `request.auth.uid == userId` の場合のみ、ユーザー配下データへアクセス可
- `subscriptions` は読み取りのみ可、書き込み禁止（サーバー/Admin SDK想定）
- 明示したコレクション以外はすべて拒否

## 動作確認（最低限）

1. ログイン済みユーザーで自分のウォッチリストを追加/削除できる
2. 同ユーザーで通知設定を更新できる
3. 別ユーザーの `users/{uid}` 配下は読み書き不可
4. `subscriptions/{uid}` へのクライアント書き込みは拒否される

## トラブルシューティング

- **`Missing or insufficient permissions`**
  - ログイン状態を確認
  - ドキュメントの `userId` と `request.auth.uid` の一致を確認
  - ルールがデプロイ済みか確認

- **ルール更新が反映されない**
  - 反映に数秒かかる場合あり
  - アプリ再読み込みで再確認

