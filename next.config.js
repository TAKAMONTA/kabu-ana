/** @type {import('next').NextConfig} */
const nextConfig = {
  // 環境変数の明示的な設定
  env: {
    SERPAPI_API_KEY: process.env.SERPAPI_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  },
  // APIルートの設定
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
