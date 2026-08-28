import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const verifyAuthMock = vi.fn();
vi.mock("@/lib/auth/verifyAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/verifyAuth")>(
    "@/lib/auth/verifyAuth"
  );
  return { ...actual, verifyAuth: (req: unknown) => verifyAuthMock(req) };
});

const getStockDataMock = vi.fn();
vi.mock("@/lib/api/marketDataClient", () => ({
  createMarketDataClient: () => ({ getStockData: getStockDataMock }),
}));

import { GET } from "../route";

function getQuotes(codes: string) {
  const request = new NextRequest(
    `http://localhost/api/watchlist/quotes?codes=${encodeURIComponent(codes)}`,
    { method: "GET", headers: { Authorization: "Bearer dummy" } }
  );
  return GET(request);
}

beforeEach(() => {
  verifyAuthMock.mockReset();
  getStockDataMock.mockReset();
  verifyAuthMock.mockResolvedValue({ uid: "user-1" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/watchlist/quotes", () => {
  it("認証エラーはそのまま返す（503）", async () => {
    verifyAuthMock.mockResolvedValue(
      NextResponse.json(
        { error: "認証サービスが利用できません" },
        { status: 503 }
      )
    );
    const response = await getQuotes("7203");
    expect(response.status).toBe(503);
  });

  it("codes が無ければ空の quotes を返す", async () => {
    const request = new NextRequest("http://localhost/api/watchlist/quotes", {
      method: "GET",
      headers: { Authorization: "Bearer dummy" },
    });
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ quotes: {} });
  });

  it("終値・前日比・asOf を返す", async () => {
    getStockDataMock.mockResolvedValue({
      symbol: "7203",
      price: 3020,
      change: 36,
      changePercent: 1.2,
      volume: 100,
      marketCap: "N/A",
      pe: 0,
      eps: 0,
      dividend: 0,
      high52: 3944,
      low52: 2675,
      asOf: "2026-08-26",
    });
    const response = await getQuotes("7203");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      quotes: {
        "7203": { close: 3020, changePercent: 1.2, asOf: "2026-08-26" },
      },
    });
  });

  it("一部のコードが取れなくても200で、そのコードだけ null", async () => {
    // 7203 は前のテストでキャッシュ済みのため、未使用のコードを使う
    getStockDataMock.mockImplementation(async (code: string) =>
      code === "6501"
        ? { price: 3020, changePercent: 1.2, asOf: "2026-08-26" }
        : null
    );
    const response = await getQuotes("6501,9999");
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.quotes["6501"]).not.toBeNull();
    expect(body.quotes["9999"]).toBeNull();
    // キャッシュヒットではなく、本当に外部呼び出しを通ったことを確かめる
    expect(getStockDataMock).toHaveBeenCalledTimes(2);
  });

  it("全部失敗しても200で、すべて null", async () => {
    // ルートのキャッシュはモジュールスコープで共有されるため、
    // 他のテストで使ったコードを使うとキャッシュヒットして
    // 「例外を catch して null」の分岐を通らない。未使用のコードを使う。
    getStockDataMock.mockRejectedValue(new Error("boom"));
    const response = await getQuotes("8306,4502");
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.quotes["8306"]).toBeNull();
    expect(body.quotes["4502"]).toBeNull();
    expect(getStockDataMock).toHaveBeenCalledTimes(2);
  });

  it("20コードを超える指定は20件に切り詰める", async () => {
    getStockDataMock.mockResolvedValue({
      price: 1,
      changePercent: 0,
      asOf: "2026-08-26",
    });
    const codes = Array.from({ length: 25 }, (_, i) => `${1000 + i}`).join(",");
    const response = await getQuotes(codes);
    const body = await response.json();
    expect(Object.keys(body.quotes)).toHaveLength(20);
  });
});
