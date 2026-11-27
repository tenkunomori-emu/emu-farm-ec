import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// 手元では、.env.local の値(開発のサンドボックスの鍵など)を読む。
// CI には .env.local がなく、ワークフローが環境変数を渡す。
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    // 結合テストは、Stripe のサンドボックスを呼ぶ(TST-014)。単体テスト(npm test)と分ける
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
  },
});
