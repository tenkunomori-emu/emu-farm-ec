import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: isCI,
  retries: 0,
  reporter: isCI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // 本番と同じビルドで動かす(TST-003)。CI では、前のステップでビルドする
  webServer: {
    command: isCI ? "npm run start" : "npm run build && npm run start",
    url: "http://localhost:3000",
    // 起動中のサーバー(next dev など)は使わない。3000 番が使われているときは、エラーで止まる
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
