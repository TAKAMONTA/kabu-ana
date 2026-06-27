import { describe, expect, it, vi } from "vitest";
import { runProductionSmokeCheck } from "../production-smoke-check.mjs";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function successfulBriefPayload() {
  return {
    data: {
      brief: {
        headline_jp: "米イラン合意で原油急落",
        summary_jp: "ホルムズ海峡再開合意で原油が下落し、関連銘柄の見方が変わる。",
        key_drivers: [{ factor: "原油価格", impact: "エネルギー株に逆風" }],
        stocks_to_watch: [
          { ticker: "7203", reason: "燃料費低下が追い風", direction: "up" },
        ],
        risk_outlook: "elevated",
      },
      generatedAt: "2026-06-17T04:01:42.774Z",
    },
    lastSuccessfulAt: "2026-06-17T04:01:42.774Z",
  };
}

function successfulSearchPayload() {
  return {
    companyInfo: {
      name: "トヨタ自動車",
      symbol: "7203",
      market: "TYO",
    },
    stockData: {
      symbol: "7203",
      price: 3000,
      change: 25,
      changePercent: 0.84,
      volume: 1000000,
      marketCap: "N/A",
      pe: 0,
      eps: 0,
      dividend: 0,
      high52: 3500,
      low52: 2500,
    },
    edinetCode: "E02144",
    accountingStandard: "USGAAP",
    ratios: { roe: 0.101, operatingMargin: 0.096 },
    financialHistory: [{ fiscalYear: 2026, revenue: 50684952000000 }],
    metadata: { dataSource: "jpx_local" },
  };
}

function successfulAppleSearchPayload() {
  return {
    companyInfo: {
      name: "Apple Inc",
      symbol: "AAPL",
      market: "NMS",
    },
    stockData: {
      symbol: "AAPL",
      price: 220,
      change: 1.5,
      changePercent: 0.69,
      volume: 50000000,
      marketCap: "N/A",
      pe: 0,
      eps: 0,
      dividend: 0,
      high52: 260,
      low52: 160,
    },
    metadata: { dataSource: "market_fast" },
  };
}

function searchPayloadForQuery(init) {
  const query = JSON.parse(init.body).query;
  return query === "AAPL"
    ? successfulAppleSearchPayload()
    : successfulSearchPayload();
}

describe("production smoke check", () => {
  it("passes when EDINET enrichment and the morning brief are both healthy", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      if (String(url).endsWith("/api/search")) {
        expect(init.method).toBe("POST");
        return jsonResponse(searchPayloadForQuery(init));
      }
      if (String(url).endsWith("/api/signals/claude-brief")) {
        return jsonResponse(successfulBriefPayload());
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await runProductionSmokeCheck({
      baseUrl: "https://kabu-ana.com/",
      briefMaxAgeHours: 36,
      fetchImpl,
      now: new Date("2026-06-17T06:00:00.000Z"),
      timeoutMs: 1000,
    });

    expect(result.ok).toBe(true);
    expect(result.failed).toEqual([]);
    expect(result.passed.map((check) => check.name)).toEqual([
      "search-edinet-7203",
      "market-data-route-7203",
      "market-data-route-aapl",
      "morning-brief",
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("fails when Toyota search does not include EDINET enrichment", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      if (String(url).endsWith("/api/search")) {
        const query = JSON.parse(init.body).query;
        if (query === "AAPL") return jsonResponse(successfulAppleSearchPayload());
        return jsonResponse({
          companyInfo: { name: "トヨタ自動車", symbol: "7203", market: "TYO" },
        });
      }
      return jsonResponse(successfulBriefPayload());
    });

    const result = await runProductionSmokeCheck({
      baseUrl: "https://kabu-ana.com",
      fetchImpl,
      now: new Date("2026-06-17T06:00:00.000Z"),
      timeoutMs: 1000,
    });

    expect(result.ok).toBe(false);
    expect(result.failed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "search-edinet-7203",
          message: expect.stringContaining("edinetCode"),
        }),
        expect.objectContaining({
          name: "market-data-route-7203",
          message: expect.stringContaining("stockData.price"),
        }),
      ])
    );
  });

  it("fails when the morning brief is an error payload or has no usable content", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      if (String(url).endsWith("/api/search")) {
        return jsonResponse(searchPayloadForQuery(init));
      }
      return jsonResponse({
        error: "朝ブリーフ生成に必要な市場シグナルが未取得です",
      });
    });

    const result = await runProductionSmokeCheck({
      baseUrl: "https://kabu-ana.com",
      fetchImpl,
      now: new Date("2026-06-17T06:00:00.000Z"),
      timeoutMs: 1000,
    });

    expect(result.ok).toBe(false);
    expect(result.failed).toEqual([
      expect.objectContaining({
        name: "morning-brief",
        message: expect.stringContaining("brief"),
      }),
    ]);
  });

  it("fails when the morning brief cache is older than the accepted age", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      if (String(url).endsWith("/api/search")) {
        return jsonResponse(searchPayloadForQuery(init));
      }
      return jsonResponse(successfulBriefPayload());
    });

    const result = await runProductionSmokeCheck({
      baseUrl: "https://kabu-ana.com",
      briefMaxAgeHours: 1,
      fetchImpl,
      now: new Date("2026-06-17T06:30:00.000Z"),
      timeoutMs: 1000,
    });

    expect(result.ok).toBe(false);
    expect(result.failed).toEqual([
      expect.objectContaining({
        name: "morning-brief",
        message: expect.stringContaining("older than 1h"),
      }),
    ]);
  });
});
