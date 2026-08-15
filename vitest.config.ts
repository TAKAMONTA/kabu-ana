import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "scripts/**/*.{test,spec}.{js,mjs,cjs,ts}",
    ],
    exclude: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "dist/**",
      "backend/**",
      "ios/**",
      "android/**",
      // 銘柄マスタ全件スキャンは数十秒かかるため既定スイートから外す。
      // 実行は `npm run test:jpx-fullscan`（vitest.fullscan.config.ts）。
      "**/*.fullscan.test.ts",
    ],
  },
});
