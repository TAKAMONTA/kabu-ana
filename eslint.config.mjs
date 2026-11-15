import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// 旧 .eslintrc.json（next/core-web-vitals + next/typescript）と同等の Flat Config。
// Next.js 16 で `next lint` が削除されたため ESLint CLI から直接読み込む。
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // eslint-config-next 16 が同梱する eslint-plugin-react-hooks v7 で追加された
      // React Compiler 系ルール。旧構成では未検査だったため、既存コードの挙動を変える
      // リファクタは別途とし、ここでは警告に留める。
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "android/**",
    "ios/**",
    "backend/**",
  ]),
]);

export default eslintConfig;
