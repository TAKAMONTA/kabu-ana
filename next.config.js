/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.EXPORT_STATIC === "true" ? "export" : undefined,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  // 実験的機能の設定
  experimental: {
    serverComponentsExternalPackages: ["@firebase/auth", "@firebase/firestore"],
  },
  // 静的エクスポート時にfirebase-adminをwebpackの外部モジュールとして扱う
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "firebase-admin": false,
        "firebase-admin/auth": false,
        "firebase-admin/app": false,
        "firebase-admin/firestore": false,
      };
    }
    return config;
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
