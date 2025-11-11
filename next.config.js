/** @type {import('next').NextConfig} */
const nextConfig = {
  // セキュリティヘッダーの設定
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
    ];
  },
  // 実験的機能の設定
  experimental: {
    serverComponentsExternalPackages: ["@firebase/auth", "@firebase/firestore"],
  },
  // 画像最適化の設定
  images: {
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
