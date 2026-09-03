import { describe, it, expect, vi, beforeEach } from "vitest";

const getNewsFromGoogleRSSMock = vi.fn();

vi.mock("@/lib/api/freeNews", () => ({
  FreeNewsClient: class {
    getNewsFromGoogleRSS(...args: unknown[]) {
      return getNewsFromGoogleRSSMock(...args);
    }
  },
}));

const TODAY = new Date().toLocaleDateString("ja-JP");

const newsItem = (id: string) => ({
  title: `テスト記事${id}`,
  snippet: `テスト記事本文${id}`,
  source: "Google News",
  date: TODAY,
  link: `https://example.com/news/${id}`,
});

/**
 * NEWS_TOPICSは6トピック。一次(when:3d)/フォールバック(when:7d)それぞれについて、
 * 呼び出し順（=NEWS_TOPICS配列の順）にcountsの件数を返すモック実装を組み立てる。
 * fallbackRejectsをtrueにすると、フォールバック側の呼び出しは全て失敗（reject）する。
 */
function buildMockImplementation(options: {
  primaryCounts?: number[];
  fallbackCounts?: number[];
  fallbackRejects?: boolean;
}) {
  let primaryCallIndex = 0;
  let fallbackCallIndex = 0;

  return async (query: string) => {
    if (query.includes("when:3d")) {
      const index = primaryCallIndex;
      primaryCallIndex += 1;
      const count = options.primaryCounts?.[index] ?? 0;
      return Array.from({ length: count }, (_, i) =>
        newsItem(`primary-${index}-${i}`)
      );
    }
    if (query.includes("when:7d")) {
      const index = fallbackCallIndex;
      fallbackCallIndex += 1;
      if (options.fallbackRejects) {
        throw new Error("fallback fetch failed");
      }
      const count = options.fallbackCounts?.[index] ?? 0;
      return Array.from({ length: count }, (_, i) =>
        newsItem(`fallback-${index}-${i}`)
      );
    }
    return [];
  };
}

const callsWith = (fragment: string) =>
  getNewsFromGoogleRSSMock.mock.calls.filter(call =>
    String(call[0]).includes(fragment)
  );

describe("GET /api/top-trading-value", () => {
  beforeEach(() => {
    // route.ts のモジュールレベルキャッシュ（cachedPayload等）をテスト間で
    // 引きずらないよう、モジュールごと再読み込みする
    vi.resetModules();
    getNewsFromGoogleRSSMock.mockReset();
  });

  it("(a) 一次集約が8件未満ならフォールバックを実行し、結果を結合して返す", async () => {
    // 一次(when:3d)は6トピック合計7件（<8件でフォールバック条件を満たす）
    // フォールバック(when:7d)は6トピック合計4件、一次と重複しないリンク/タイトルで用意
    getNewsFromGoogleRSSMock.mockImplementation(
      buildMockImplementation({
        primaryCounts: [2, 1, 1, 1, 1, 1],
        fallbackCounts: [1, 1, 1, 1, 0, 0],
      })
    );

    const { GET } = await import("../route");
    const response = await GET();
    const body = await response.json();

    expect(callsWith("when:3d")).toHaveLength(6);
    expect(callsWith("when:7d")).toHaveLength(6);
    // 一次7件 + フォールバック4件 = 重複なしで11件が結合される（一次側が捨てられない）
    expect(body.metadata.newsCount).toBe(11);
  });

  it("(b) 一次集約が8件以上ならフォールバックを実行しない", async () => {
    getNewsFromGoogleRSSMock.mockImplementation(
      buildMockImplementation({
        primaryCounts: [2, 1, 1, 1, 1, 2],
      })
    );

    const { GET } = await import("../route");
    const response = await GET();
    const body = await response.json();

    expect(callsWith("when:3d")).toHaveLength(6);
    expect(callsWith("when:7d")).toHaveLength(0);
    expect(body.metadata.newsCount).toBe(8);
  });

  it("(c) フォールバックが全滅しても一次の結果は失わずに返す", async () => {
    getNewsFromGoogleRSSMock.mockImplementation(
      buildMockImplementation({
        primaryCounts: [1, 1, 1, 0, 0, 0],
        fallbackRejects: true,
      })
    );

    const { GET } = await import("../route");
    const response = await GET();
    const body = await response.json();

    expect(callsWith("when:3d")).toHaveLength(6);
    expect(callsWith("when:7d")).toHaveLength(6);
    expect(body.metadata.newsCount).toBe(3);
    expect(body.warning).not.toBe("news_unavailable");
  });

  it("(d) 一次取得のクエリには「 when:3d」が付与される", async () => {
    getNewsFromGoogleRSSMock.mockImplementation(
      buildMockImplementation({ primaryCounts: [0, 0, 0, 0, 0, 0] })
    );

    const { GET } = await import("../route");
    await GET();

    expect(getNewsFromGoogleRSSMock.mock.calls[0][0]).toBe(
      "日本株 急騰 銘柄 when:3d"
    );
  });

  it("(e) 一次記事は結合結果の先頭に来て、合計40件超でも一次記事は切り捨てられない", async () => {
    // 一次(when:3d)は6トピックそれぞれ1件・実在の企業名を含む記事（<8件でフォールバック条件を満たす）
    const primaryArticles = [
      {
        title: "ソニーグループ、決算で上方修正",
        snippet: "業績上振れが材料視されています。",
        source: "Google News",
        date: TODAY,
        link: "https://example.com/primary/sony",
      },
      {
        title: "トヨタ自動車、決算で上方修正",
        snippet: "業績上振れが材料視されています。",
        source: "Google News",
        date: TODAY,
        link: "https://example.com/primary/toyota",
      },
      {
        title: "任天堂、決算で上方修正",
        snippet: "業績上振れが材料視されています。",
        source: "Google News",
        date: TODAY,
        link: "https://example.com/primary/nintendo",
      },
      {
        title: "三菱UFJ、決算で上方修正",
        snippet: "業績上振れが材料視されています。",
        source: "Google News",
        date: TODAY,
        link: "https://example.com/primary/mufg",
      },
      {
        title: "INPEX、決算で上方修正",
        snippet: "業績上振れが材料視されています。",
        source: "Google News",
        date: TODAY,
        link: "https://example.com/primary/inpex",
      },
      {
        title: "ソフトバンクグループ、決算で上方修正",
        snippet: "業績上振れが材料視されています。",
        source: "Google News",
        date: TODAY,
        link: "https://example.com/primary/softbank",
      },
    ];

    let primaryCallIndex = 0;
    let fallbackCallIndex = 0;
    getNewsFromGoogleRSSMock.mockImplementation(async (query: string) => {
      if (query.includes("when:3d")) {
        const article = primaryArticles[primaryCallIndex];
        primaryCallIndex += 1;
        return article ? [article] : [];
      }
      if (query.includes("when:7d")) {
        // トピックあたり8件・6トピックで合計48件（企業名を含まない一般記事）。
        // 一次6件と合わせると54件になり、40件キャップに掛かる
        const index = fallbackCallIndex;
        fallbackCallIndex += 1;
        return Array.from({ length: 8 }, (_, i) =>
          newsItem(`fallback-${index}-${i}`)
        );
      }
      return [];
    });

    const { GET } = await import("../route");
    const response = await GET();
    const body = await response.json();

    // 一次6件+フォールバック48件=54件のうち、40件キャップで先頭40件のみ残る。
    // 一次(when:3d)側を先頭に並べているため、一次6件は必ず生き残る
    expect(body.metadata.newsCount).toBe(40);
    // 企業名一致は一次記事にしかないため、生き残っていればマッチする
    expect(body.metadata.matchedCount).toBeGreaterThan(0);
    expect(
      body.items.some((item: { code: string }) =>
        ["6758", "7203", "7974", "8306", "1605", "9984"].includes(item.code)
      )
    ).toBe(true);
  });
});
