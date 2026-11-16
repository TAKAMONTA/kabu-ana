import { defineConfig, devices } from "@playwright/test";

/**
 * ブラウザでの通し確認（E2E）。
 * - 外部ネットワークと API キーは使わない。アプリ自身の /api/** は各テストで
 *   page.route により固定の応答を返し、外部ホストへの通信は空応答で止める（e2e/fixtures.ts）。
 * - 既定では本番ビルドを作ってから next start で起動する。
 *   E2E_SKIP_BUILD=1 なら既存の .next を使い、起動済みのサーバーがあれば再利用する（ローカルのみ）。
 * - ローカルで同梱の Chromium を使えないときは PLAYWRIGHT_CHROMIUM_EXECUTABLE で実行ファイルを指定できる。
 */
const PORT = Number(process.env.E2E_PORT || 3210);
const baseURL = `http://127.0.0.1:${PORT}`;
const isCI = Boolean(process.env.CI);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

const startCommand = `npx next start -H 127.0.0.1 -p ${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: isCI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    trace: "off",
    screenshot: "only-on-failure",
    // 既定はライト表示から始める（テーマ切替テストの前提をそろえる）
    colorScheme: "light",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD
      ? startCommand
      : `npm run build && ${startCommand}`,
    url: baseURL,
    reuseExistingServer: !isCI && Boolean(process.env.E2E_SKIP_BUILD),
    timeout: 240_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
