import { defineConfig } from "vitest/config";

export default defineConfig({
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
    ],
  },
});
