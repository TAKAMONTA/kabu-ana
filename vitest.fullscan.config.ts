import { defineConfig } from "vitest/config";
import path from "path";

/**
 * 銘柄マスタ全件スキャン専用の vitest 設定（`npm run test:jpx-fullscan`）。
 *
 * 既定の vitest.config.ts は fullscan.test.ts を exclude しているため、
 * 全件スキャンはこの設定からのみ実行される。日常のテスト実行（約3秒）を
 * 数十秒に延ばさないための分離。
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.fullscan.test.ts"],
    exclude: ["node_modules/**", ".next/**", "out/**", "dist/**"],
  },
});
