import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // 本番(Vercel)のランタイムTZ=UTCと揃える。JST日バケット計算のTZ非依存性を
    // 開発者のローカルTZに関係なく検証できるようにする
    env: {
      TZ: "UTC",
    },
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "scripts/**/*.{test,spec}.{js,mjs,cjs,ts,mts}",
    ],
    exclude: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "dist/**",
      "backend/**",
      "ios/**",
      "android/**",
      // ブラウザでの通し確認は Playwright で実行する（npm run test:e2e）
      "e2e/**",
      "playwright-report/**",
      "test-results/**",
      // 銘柄マスタ全件スキャンは数十秒かかるため既定スイートから外す。
      // 実行は `npm run test:jpx-fullscan`（vitest.fullscan.config.ts）。
      "**/*.fullscan.test.ts",
    ],
  },
});
