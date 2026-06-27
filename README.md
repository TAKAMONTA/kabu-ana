# 🚀 AI Market Analyzer (kabu-ana)

株式分析をAIで支援するNext.jsアプリケーションです。J-Quants（日本株）、Twelve Data（米国株）、OpenRouterを統合し、株価データ、ニュース、財務情報を参考情報として整理します。

## ✨ 主な機能

- 🔍 **企業検索**: 証券コード、ティッカーシンボル、企業名での検索
- 📊 **リアルタイム株価**: 最新の株価データとチャート表示
- 🤖 **AI分析**: OpenRouterを使用した材料・リスク・確認ポイントの整理
- 📈 **チャート表示**: インタラクティブな株価チャート
- 🔐 **認証システム**: Firebase認証によるユーザー管理
- 📱 **レスポンシブデザイン**: モバイル対応のモダンUI

## 🛠️ 技術スタック

- **フロントエンド**: Next.js 16, React 19, TypeScript
- **スタイリング**: Tailwind CSS, Radix UI
- **バックエンド**: NestJS (準備中)
- **認証**: Firebase Authentication
- **データ取得**: J-Quants（日本株）, Twelve Data（米国株）
- **AI分析**: OpenRouter (Claude 3.5 Sonnet)
- **デプロイ**: Vercel

## 🚀 クイックスタート

### 1. リポジトリのクローン

```bash
git clone https://github.com/TAKAMONTA/kabu-ana.git
cd kabu-ana
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.local`ファイルを作成し、以下の環境変数を設定してください：

```env
# Market Data Configuration
JQUANTS_EMAIL=your_jquants_email_here
JQUANTS_PASSWORD=your_jquants_password_here
TWELVE_DATA_API_KEY=your_twelve_data_key_here
# Legacy SerpAPI is disabled unless explicitly enabled.
# ENABLE_LEGACY_SERPAPI=true
# SERPAPI_API_KEY=your_serpapi_key_here

# OpenRouter Configuration
OPENROUTER_API_KEY=your_openrouter_key_here

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

アプリケーションは `http://localhost:3000` で起動します。

## 📋 必要なAPIキー

### J-Quants / Twelve Data
1. [J-Quants](https://jpx-jquants.com/)でアカウントを作成し、メールアドレスとパスワードを取得
2. [Twelve Data](https://twelvedata.com/)でAPIキーを取得
3. `.env.local`に `JQUANTS_EMAIL`, `JQUANTS_PASSWORD`, `TWELVE_DATA_API_KEY` を設定

### SerpAPI（レガシー）
通常は使用しません。検証目的で旧SerpAPI経路を使う場合のみ、`ENABLE_LEGACY_SERPAPI=true` と `SERPAPI_API_KEY` を設定してください。

### OpenRouter
1. [OpenRouter](https://openrouter.ai/)でアカウントを作成
2. APIキーを取得
3. `.env.local`に設定

### Firebase
1. [Firebase Console](https://console.firebase.google.com/)でプロジェクトを作成
2. Authenticationを有効化
3. Webアプリを追加
4. 設定値を`.env.local`に設定

## 🌐 デプロイ

### Vercelでのデプロイ

1. [Vercel](https://vercel.com/)でアカウントを作成
2. GitHubリポジトリをインポート
3. 環境変数を設定
4. デプロイ完了

### 環境変数の設定（Vercel）

Vercelダッシュボードで以下の環境変数を設定してください：

- `JQUANTS_EMAIL`
- `JQUANTS_PASSWORD`
- `TWELVE_DATA_API_KEY`
- `OPENROUTER_API_KEY`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## 📁 プロジェクト構造

```
kabu-ana/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API Routes
│   │   └── page.tsx        # メインページ
│   ├── components/         # Reactコンポーネント
│   │   └── ui/            # UIコンポーネント
│   ├── hooks/             # カスタムフック
│   └── lib/               # ユーティリティとAPI統合
├── backend/               # NestJSバックエンド（開発中）
└── public/               # 静的ファイル
```

## 🔧 開発

### 利用可能なスクリプト

- `npm run dev` - 開発サーバー起動
- `npm run build` - プロダクションビルド
- `npm run start` - プロダクションサーバー起動
- `npm run lint` - ESLint実行

### コード品質

- TypeScriptによる型安全性
- ESLintによるコード品質チェック
- Prettierによるコードフォーマット

## 📊 機能詳細

### 株式検索
- 日本株（4桁コード）と米国株（ティッカーシンボル）に対応
- 企業名での検索も可能
- リアルタイムの株価データ取得

### AI分析
- Claudeによる参考分析
- AI推定レンジの表示
- リスク評価
- SWOT分析
- 確認ポイントの整理

### チャート機能
- インタラクティブな株価チャート
- 複数の期間選択（1日、1週間、1ヶ月、1年）
- 出来高データの表示

## 🤝 貢献

プルリクエストやイシューの報告を歓迎します。

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 📞 サポート

問題や質問がある場合は、GitHubのIssuesで報告してください。

---

**注意**: このアプリケーションは投資助言や売買推奨を目的としたものではありません。AIの分析結果は参考情報として活用し、最終的な投資判断はご自身の責任で行ってください。情報の正確性・完全性を保証するものではありません。
