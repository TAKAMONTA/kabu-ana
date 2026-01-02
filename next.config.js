/** @type {import('next').NextConfig} */
const nextConfig = {
  // 注意: output: "export" を削除しました
  // 静的エクスポートではAPI Routesが動作しないため、動的モードを使用します
  // セキュリティヘッダーはサーバー側（Vercel/ホスティング）で設定してください
  // 実験的機能の設定
  experimental: {
    serverComponentsExternalPackages: ["@firebase/auth", "@firebase/firestore"],
  },
  // 画像最適化の設定
  images: {
    unoptimized: true,
    domains: [
      "www24.a8.net",
      "www17.a8.net",
      "www25.a8.net",
      "www10.a8.net",
    ],
  },
  // 本番環境での最適化
  // output: "standalone", // Vercelデプロイエラーのため一時的に無効化
  // 環境変数の検証
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

module.exports = nextConfig;
