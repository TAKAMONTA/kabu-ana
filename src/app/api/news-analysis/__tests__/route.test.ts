import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const comprehensiveNewsMock = vi.fn(async () => [] as unknown[]);
const analyzeNewsImpactMock = vi.fn();

vi.mock("@/lib/api/freeNews", () => ({
  FreeNewsClient: class {
    getComprehensiveNews(...args: unknown[]) {
      return comprehensiveNewsMock(...(args as []));
    }
  },
}));

vi.mock("@/lib/api/marketDataClient", () => ({
  createMarketDataClient: () => ({
    getCompanyNews: async () => [],
    getCompanyNewsByName: async () => [],
  }),
}));

vi.mock("@/lib/api/openrouter", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/openrouter")>(
    "@/lib/api/openrouter"
  );
  return {
    ...actual,
    OpenRouterClient: class {
      analyzeNewsImpact(...args: unknown[]) {
        return analyzeNewsImpactMock(...args);
      }
    },
  };
});

import { POST } from "../route";
import { AI_SERVICE_UNAVAILABLE_MESSAGE } from "@/lib/api/openrouterConfig";

// 空白入力のガードは全ての外部呼び出し（Yahoo/Google RSS/OpenRouter）より前に
// 評価されるため、外部APIキー無しで検証できる。POSTはwithRateLimit/withDailyLimit
// でラップされているが、レート制限は15分100リクエスト/IP+パス、日次制限は
// response.okのときだけ加算されるため、少数の400レスポンスを送るだけの
// このテストでは制限に抵触しない
function postNewsAnalysis(body: unknown) {
  const request = new NextRequest("http://localhost/api/news-analysis", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request);
}

/** body: JSON.stringify()を経由せず、生のリクエストボディ文字列をそのまま送る */
function postRawBody(rawBody: string) {
  const request = new NextRequest("http://localhost/api/news-analysis", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: rawBody,
  });
  return POST(request);
}

describe("POST /api/news-analysis: blank input guards", () => {
  it('{"symbol":" ","companyName":" "} は400（空白のみはtrim後に空として弾く）', async () => {
    const response = await postNewsAnalysis({ symbol: " ", companyName: " " });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("シンボルと企業名が必要です");
  });

  it('{"symbol":"","companyName":"トヨタ自動車"} は400（symbol欠落）', async () => {
    const response = await postNewsAnalysis({
      symbol: "",
      companyName: "トヨタ自動車",
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("シンボルと企業名が必要です");
  });

  it('{"symbol":"7203"} は400（companyName欠落）', async () => {
    const response = await postNewsAnalysis({ symbol: "7203" });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("シンボルと企業名が必要です");
  });

  it("不正なJSON body は400（従来はrequest.json()が例外を投げ500になっていた）", async () => {
    const response = await postRawBody("not-json");
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("シンボルと企業名が必要です");
  });

  it("bodyがnullは400（分割代入がTypeErrorにならず400で弾く）", async () => {
    const response = await postNewsAnalysis(null);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("シンボルと企業名が必要です");
  });
});

describe("POST /api/news-analysis: configuration and usage counting", () => {
  const originalKey = process.env.OPENROUTER_API_KEY;
  let ipCounter = 0;
  let ip = "";

  function post(body: unknown) {
    return POST(
      new NextRequest("http://localhost/api/news-analysis", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify(body),
      })
    );
  }

  beforeEach(() => {
    ipCounter += 1;
    ip = `203.0.113.${100 + ipCounter}`;
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    comprehensiveNewsMock.mockReset();
    comprehensiveNewsMock.mockResolvedValue([]);
    analyzeNewsImpactMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
  });

  it("returns 503 with a fixed message (no env var name) when OpenRouter is not configured", async () => {
    // .env.example の値（以前 analyze はこの値を素通ししていた）
    process.env.OPENROUTER_API_KEY = "your_openrouter_api_key_here";
    const response = await post({ symbol: "7203", companyName: "トヨタ自動車" });
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain("OPENROUTER");
    expect(JSON.parse(text).error).toBe(AI_SERVICE_UNAVAILABLE_MESSAGE);
  });

  it("does not consume the free quota when no news was found (empty: true)", async () => {
    for (let i = 0; i < 7; i++) {
      const response = await post({ symbol: "7203", companyName: "トヨタ自動車" });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ newsData: [], analysis: null, empty: true });
    }
    expect(analyzeNewsImpactMock).not.toHaveBeenCalled();
  });

  it("does not consume the free quota when the AI analysis failed (parseFailed)", async () => {
    comprehensiveNewsMock.mockResolvedValue([{ title: "t", snippet: "s" }]);
    analyzeNewsImpactMock.mockResolvedValue({ impact: "neutral", parseFailed: true });
    for (let i = 0; i < 7; i++) {
      expect((await post({ symbol: "7203", companyName: "トヨタ自動車" })).status).toBe(200);
    }
    analyzeNewsImpactMock.mockResolvedValue({ impact: "positive" });
    for (let i = 0; i < 5; i++) {
      expect((await post({ symbol: "7203", companyName: "トヨタ自動車" })).status).toBe(200);
    }
    expect((await post({ symbol: "7203", companyName: "トヨタ自動車" })).status).toBe(403);
  });
});
