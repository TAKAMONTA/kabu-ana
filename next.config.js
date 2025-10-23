/** @type {import('next').NextConfig} */
const nextConfig = {
  // 環境変数の明示的な設定
  env: {
    SERPAPI_API_KEY: process.env.SERPAPI_API_KEY,
    FMP_API_KEY: process.env.FMP_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  },
  // 実験的機能の設定
  experimental: {
    serverComponentsExternalPackages: ["@firebase/auth", "@firebase/firestore"],
  },
  // 画像最適化の設定
  images: {
    domains: ["www24.a8.net", "www17.a8.net"],
  },
};

module.exports = nextConfig;
