import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Prettier と競合するルールを無効にする。ほかの設定より後に置く。
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 方式検証のコード。サイトのコードではない。
    "spikes/**",
    // Playwright の結果
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
