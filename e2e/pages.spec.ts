import { expect, expectNoPageProblems, json, test } from "./fixtures";

const SIGNAL_ENDPOINTS = [
  "GET /api/signals/prices",
  "GET /api/signals/risk",
  "GET /api/signals/news",
  "GET /api/signals/seismic",
  "GET /api/signals/claude-brief",
] as const;

/** Next.js が常に置く（空の）ページ遷移読み上げ用の要素は除く */
const ALERTS = '[role="alert"]:not(#__next-route-announcer__)';

/** 利用者に見せてはいけない技術的な英語 */
const RAW_ENGLISH = /fetch failed|Failed to fetch|HTTP \d{3}|ECONN|undefined|null|Error:/;

test.describe("マーケット・シグナル", () => {
  test("API がエラーを返しても日本語の案内だけを出す", async ({
    page,
    pageProblems,
    apiMocks,
  }) => {
    for (const key of SIGNAL_ENDPOINTS) {
      apiMocks[key] = json({ data: null, error: "fetch failed" });
    }
    await page.goto("/signals");
    await expect(
      page.getByRole("heading", { name: "マーケット・シグナル" })
    ).toBeVisible();
    await expect(
      page.getByText(
        "緊急アラートの状況を取得できませんでした。時間をおいて再度ご確認ください。"
      )
    ).toBeVisible();
    await expect(page.locator(ALERTS).first()).toBeVisible();
    await page.waitForLoadState("networkidle");

    const alerts = page.locator(ALERTS);
    const count = await alerts.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(alerts.nth(i)).toContainText(/[぀-ヿ一-龯]/);
    }
    await expect(page.locator("body")).not.toContainText(RAW_ENGLISH, {
      useInnerText: true,
    });

    expectNoPageProblems(pageProblems);
  });

  test("データがまだ無いときは日本語の空状態を出す", async ({
    page,
    pageProblems,
  }) => {
    await page.goto("/signals");
    await expect(
      page.getByText("緊急アラートの状況はまだ取得できていません。")
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.locator(ALERTS)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(RAW_ENGLISH, {
      useInnerText: true,
    });

    expectNoPageProblems(pageProblems);
  });
});

test("存在しない URL では日本語の 404 ページを出す", async ({
  page,
  pageProblems,
}) => {
  const response = await page.goto("/no-such-page-e2e");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "ページが見つかりません" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "kabuana のトップへ戻る" })
  ).toHaveAttribute("href", "/");

  // 文書自体が 404 なので、その読み込みログだけは許容する
  expectNoPageProblems(pageProblems, [/status of 404/]);
});
