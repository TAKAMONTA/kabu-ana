/** @type {import('next').NextConfig} */
const isStaticExport = process.env.EXPORT_STATIC === "true";

const nextConfig = {
  output: isStaticExport ? "export" : undefined,
  ...(isStaticExport
    ? {
        // 静的エクスポート（Capacitor 用）では API Route（src/app/api/**/route.ts）を
        // ビルド対象から外す。ネイティブアプリは本番 API（getApiBaseUrl）を直接叩くため不要で、
        // Next.js 15+ では route segment config（`dynamic`）が静的な文字列リテラル必須となり
        // 環境変数での force-static / force-dynamic 切替ができなくなったため。
        // ページ・レイアウトは .tsx のみなので影響しない（.ts のルートファイルを追加する場合は注意）。
        pageExtensions: ["tsx", "jsx", "js"],
        // Vercel Web Analytics はアプリでは使えない（解析スクリプトが無く 404 になる）ため、
        // 解析コードごと空の実装に差し替えて同梱しない。
        turbopack: {
          resolveAlias: {
            "@vercel/analytics/next": "./src/lib/stubs/vercel-analytics-next.tsx",
          },
        },
      }
    : {
        async headers() {
          return [
            {
              source: "/(.*)",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "X-Frame-Options", value: "DENY" },
                { key: "X-XSS-Protection", value: "1; mode=block" },
                {
                  key: "Referrer-Policy",
                  value: "strict-origin-when-cross-origin",
                },
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
      }),
  // サーバー側でバンドルせず Node.js の require に任せるパッケージ
  // （Next.js 15 で experimental.serverComponentsExternalPackages から改名）
  serverExternalPackages: ["@firebase/auth", "@firebase/firestore"],
  // Next.js 16 から next build も Turbopack が既定。旧 webpack() の resolve.fallback
  // （クライアント側で firebase-admin を空モジュール化）は、クライアントバンドルが
  // firebase-admin を参照していないため不要として削除した（誤って参照すればビルドが失敗して検知できる）。
  // 画像最適化の設定
  images: {
    unoptimized: true,
    // images.domains は Next.js 16 で非推奨のため remotePatterns へ移行
    remotePatterns: [
      "www24.a8.net",
      "www17.a8.net",
      "www25.a8.net",
      "www10.a8.net",
    ].map((hostname) => ({ protocol: "https", hostname })),
  },
  // 本番環境での最適化
  // output: "standalone", // Vercelデプロイエラーのため一時的に無効化
  // 環境変数の検証
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

module.exports = nextConfig;
