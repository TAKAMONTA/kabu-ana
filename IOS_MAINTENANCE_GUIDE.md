# iOS メンテナンス & トラブルシューティングガイド

このプロジェクトの iOS 版を開発・更新する際に、混乱を防ぎスムーズに作業するための重要事項を記録します。

## 1. アプリの基本情報（最重要）

App Store Connect のレコードと完全に一致させる必要がある項目です。

- **Bundle Identifier (App ID)**: `com.takaapps.kabunavi`
- **App Name (プロジェクト内)**: `kabunavi`
- **表示名 (ホーム画面)**: `Kabuana`

> [!WARNING]
> これらの値を一つでも間違うと、App Store へのアップロード時に「App Name already in use」エラーが発生したり、シミュレータに重複してアプリがインストールされたりします。

## 2. 通信（API）に関する重要ルール

ブラウザ（Next.js）側で使用する標準の `fetch` は、iOS アプリ内では CORS 制限やオリジンの問題で失敗することがあります。

- **ルール**: 全ての API 通信（`/api/*`）は **`CapacitorHttp`** を使用してください。
- **実装例**: `src/hooks/` 内の各フック（`useTopTradingValue.ts` 等）を参照。
- **接続先**: シミュレータ環境では `https://kabu-ana.com`（本番 URL）へ直接アクセスするように `apiClient.ts` で動的に解決されます。

## 3. ビルドと同期の標準手順

環境を最新の状態に保つためのコマンドフローです。

```bash
# 1. APIディレクトリを一時退避（静的ビルド時の型エラー防止）
mv src/app/api ../backend_backup

# 2. 静的エクスポート（Capacitor用）
npm run build:static

# 3. APIディレクトリを復元
mv ../backend_backup src/app/api

# 4. Capacitor iOSプロジェクトへの反映
npx cap sync ios
```

## 4. トラブルシューティング（困ったときは）

### 変更が反映されない / アイコンがおかしい
1.  シミュレータ上のアプリを長押しして **削除** してください。
2.  Xcode で `Product` > **`Clean Build Folder`** を実行してください。
3.  再度 ▶ (Run) ボタンでビルドしてください。

### アップロード時にエラーが出る
- **チーム設定**: `Signing & Capabilities` タブの `Team` が正しいか確認してください。
- **Identifier**: `PRODUCT_BUNDLE_IDENTIFIER` が `com.takaapps.kabunavi` になっているか確認してください。

---
このファイルは、AI や他の開発者が作業を再開する際の「地図」として活用してください。
