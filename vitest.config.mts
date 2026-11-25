import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // tsconfig.json の paths(@/*)を、テストでも使う
    tsconfigPaths: true,
  },
  test: {
    // 単体テストは、テストするファイルの隣に置く
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});
