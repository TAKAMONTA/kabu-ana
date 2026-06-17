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
    edinetCode: "E02144",
    accountingStandard: "USGAAP",
    ratios: { roe: 0.101, operatingMargin: 0.096 },
    financialHistory: [{ fiscalYear: 2026, revenue: 50684952000000 }],
  };
}

describe("production smoke check", () => {
  it("passes when EDINET enrichment and the morning brief are both healthy", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      if (String(url).endsWith("/api/search")) {
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body)).toEqual({ query: "7203" });
        return jsonResponse(successfulSearchPayload());
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
      "morning-brief",
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("fails when Toyota search does not include EDINET enrichment", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).endsWith("/api/search")) {
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
    expect(result.failed).toEqual([
      expect.objectContaining({
        name: "search-edinet-7203",
        message: expect.stringContaining("edinetCode"),
      }),
    ]);
  });

  it("fails when the morning brief is an error payload or has no usable content", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).endsWith("/api/search")) {
        return jsonResponse(successfulSearchPayload());
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
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).endsWith("/api/search")) {
        return jsonResponse(successfulSearchPayload());
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
