import { test as base, expect, type Page, type Route } from "@playwright/test";

/**
 * E2E 共通の下準備。
 * - アプリ自身の /api/** は固定の応答（モック）を返す。テストごとに上書きできる。
 * - 外部ホスト（広告画像・Firebase・フォント等）への通信は空応答で止め、外部ネットワークに出ない。
 * - ページ内の例外・console.error・ハイドレーションの警告を記録し、テスト終了時に無いことを確かめる。
 */

export type ApiHandler = (route: Route) => Promise<void> | void;
export type ApiMocks = Record<string, ApiHandler>;

export const json =
  (body: unknown, status = 200): ApiHandler =>
  route =>
    route.fulfill({
      status,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(body),
    });

export const TOYOTA_SEARCH_RESULT = {
  companyInfo: {
    name: "トヨタ自動車",
    symbol: "7203",
    market: "TYO",
    description: "プライム / 輸送用機器",
  },
  stockData: {
    symbol: "7203",
    price: 2845.5,
    change: 12.5,
    changePercent: 0.44,
    volume: 12_345_600,
    marketCap: "46.4兆円",
    pe: 9.8,
    eps: 290.1,
    dividend: 2.9,
    high52: 3891,
    low52: 2226,
    asOf: "2026-11-13",
  },
  newsData: [],
  chartData: [
    { date: "2026-11-11", price: 2810, volume: 10_000_000 },
    { date: "2026-11-12", price: 2833, volume: 11_000_000 },
    { date: "2026-11-13", price: 2845.5, volume: 12_345_600 },
  ],
  financialData: null,
  metadata: { dataSource: "e2e", fetchedAt: "2026-11-13T06:00:00.000Z" },
};

export const TRADING_RANKING = {
  items: [
    {
      rank: 1,
      code: "7203",
      name: "トヨタ自動車",
      reason: "決算発表で注目を集めています。",
      confidence: 0.8,
      sources: ["e2e"],
      price: 2845.5,
      change: 12.5,
      changePercent: 0.44,
      volume: 12_345_600,
      value: 35_000_000_000,
      priceDisplay: "2,845.5円",
      changeDisplay: "+12.5円",
      volumeDisplay: "1,234万株",
      valueDisplay: "350億円",
    },
  ],
};

/** /api/analyze の SSE。結果 JSON は返さず、短い文章だけ流して終わる */
const analyzeStream: ApiHandler = route =>
  route.fulfill({
    status: 200,
    contentType: "text/event-stream; charset=utf-8",
    body: "event: narrative\ndata: E2E用の短い分析です。\n\n",
  });

export const DEFAULT_API_MOCKS: ApiMocks = {
  "GET /api/top-trading-value": json(TRADING_RANKING),
  "POST /api/search-suggestions": json({ suggestions: [] }),
  "POST /api/search": json(TOYOTA_SEARCH_RESULT),
  "POST /api/analyze": analyzeStream,
  "GET /api/signals/prices": json({ data: null }),
  "GET /api/signals/risk": json({ data: null }),
  "GET /api/signals/news": json({ data: null }),
  "GET /api/signals/seismic": json({ data: null }),
  "GET /api/signals/claude-brief": json({ data: null }),
};

type Fixtures = {
  /** テスト内で API の応答を差し替える（page.goto より前に呼ぶ） */
  apiMocks: ApiMocks;
  /** 呼ばれた API（"METHOD /path"）の記録 */
  apiCalls: string[];
  /** ページ内の例外・console.error */
  pageProblems: string[];
};

export const test = base.extend<Fixtures>({
  apiMocks: async ({}, use) => {
    await use({ ...DEFAULT_API_MOCKS });
  },
  apiCalls: async ({}, use) => {
    await use([]);
  },
  pageProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("pageerror", error => problems.push(`pageerror: ${error.message}`));
      page.on("console", message => {
        const text = message.text();
        if (message.type() === "error") problems.push(`console.error: ${text}`);
        if (/hydrat/i.test(text)) problems.push(`hydration: ${text}`);
      });
      await use(problems);
    },
    { auto: true },
  ],
  page: async ({ page, apiMocks, apiCalls, baseURL }, use) => {
    const appOrigin = new URL(baseURL!).origin;
    const unmocked: string[] = [];

    await page.route("**/*", async route => {
      const request = route.request();
      const url = new URL(request.url());

      if (url.origin !== appOrigin) {
        // 外部ホストには出ない。画像は透明 1px、それ以外は空で返す
        if (request.resourceType() === "image") {
          return route.fulfill({
            status: 200,
            contentType: "image/gif",
            body: Buffer.from(
              "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
              "base64"
            ),
          });
        }
        return route.fulfill({ status: 204, body: "" });
      }

      // Vercel Web Analytics のスクリプトは Vercel 上にしか無いので空で返す
      if (url.pathname.startsWith("/_vercel/")) {
        return route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: "",
        });
      }

      if (url.pathname.startsWith("/api/")) {
        const key = `${request.method()} ${url.pathname}`;
        apiCalls.push(key);
        const handler = apiMocks[key];
        if (handler) return handler(route);
        unmocked.push(key);
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: `E2E: ${key} はモックされていません` }),
        });
      }

      return route.continue();
    });

    await use(page);

    expect(unmocked, "モックしていない API が呼ばれた").toEqual([]);
  },
});

export { expect };

/** 検索欄に入力して Enter で検索する */
export async function searchBy(page: Page, query: string) {
  const input = page.getByRole("combobox", { name: "企業検索" });
  await input.fill(query);
  await input.press("Enter");
}

/**
 * ページ内の例外・console.error が無いことを確かめる。
 * allow には、そのテストで意図して起こしている問題（わざと 404 を返す等）だけを渡す。
 */
export function expectNoPageProblems(problems: string[], allow: RegExp[] = []) {
  const unexpected = problems.filter(
    problem => !allow.some(pattern => pattern.test(problem))
  );
  expect(
    unexpected,
    "ページ内の例外・console.error・ハイドレーション警告"
  ).toEqual([]);
}
