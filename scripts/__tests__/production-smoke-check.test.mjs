import { describe, expect, it, vi } from "vitest";
import {
  createProductionSmokeChecks,
  runProductionSmokeCheck,
} from "../production-smoke-check.mjs";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// firebase-admin-healthチェック用: 偽トークンが正しく拒否された健全な状態(401)のレスポンス。
function healthySubscriptionCheckResponse() {
  return jsonResponse({ error: "認証に失敗しました" }, 401);
}

function firebaseAdminHealthCheckOnly(options) {
  return createProductionSmokeChecks(options).filter(
    (check) => check.name === "firebase-admin-health"
  );
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
      if (String(url).endsWith("/api/subscription/check")) {
        expect(init.headers.Authorization).toBe(
          "Bearer smoke-check-invalid-token"
        );
        return healthySubscriptionCheckResponse();
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
      "firebase-admin-health",
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
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
      if (String(url).endsWith("/api/subscription/check")) {
        return healthySubscriptionCheckResponse();
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

  it("fails when a market data route reports an unexpected dataSource", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      if (String(url).endsWith("/api/search")) {
        const query = JSON.parse(init.body).query;
        if (query === "AAPL") return jsonResponse(successfulAppleSearchPayload());
        return jsonResponse({
          ...successfulSearchPayload(),
          metadata: { dataSource: "unexpected_source" },
        });
      }
      if (String(url).endsWith("/api/subscription/check")) {
        return healthySubscriptionCheckResponse();
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
          name: "market-data-route-7203",
          message: expect.stringContaining(
            "metadata.dataSource expected one of jpx_local, market_fast, market_fallback but got unexpected_source"
          ),
        }),
      ])
    );
  });

  it("passes even when stockData.pe is a real (non-zero) value", async () => {
    // J-Quants が将来 PER を返すようになっても誤検知しないことの回帰テスト。
    const fetchImpl = vi.fn(async (url, init) => {
      if (String(url).endsWith("/api/search")) {
        const query = JSON.parse(init.body).query;
        if (query === "AAPL") return jsonResponse(successfulAppleSearchPayload());
        return jsonResponse({
          ...successfulSearchPayload(),
          stockData: { ...successfulSearchPayload().stockData, pe: 12.5 },
        });
      }
      if (String(url).endsWith("/api/subscription/check")) {
        return healthySubscriptionCheckResponse();
      }
      return jsonResponse(successfulBriefPayload());
    });

    const result = await runProductionSmokeCheck({
      baseUrl: "https://kabu-ana.com",
      fetchImpl,
      now: new Date("2026-06-17T06:00:00.000Z"),
      timeoutMs: 1000,
    });

    expect(result.ok).toBe(true);
    expect(result.failed).toEqual([]);
  });

  it("fails when the morning brief is an error payload or has no usable content", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      if (String(url).endsWith("/api/search")) {
        return jsonResponse(searchPayloadForQuery(init));
      }
      if (String(url).endsWith("/api/subscription/check")) {
        return healthySubscriptionCheckResponse();
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
      if (String(url).endsWith("/api/subscription/check")) {
        return healthySubscriptionCheckResponse();
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

  describe("firebase-admin-health probe", () => {
    it("passes when subscription/check rejects an invalid token with 401 (Admin SDK healthy)", async () => {
      const fetchImpl = vi.fn(async (url, init) => {
        expect(String(url)).toContain("/api/subscription/check");
        expect(init.method).toBe("GET");
        expect(init.headers.Authorization).toBe(
          "Bearer smoke-check-invalid-token"
        );
        return healthySubscriptionCheckResponse();
      });

      const options = {
        baseUrl: "https://kabu-ana.com",
        fetchImpl,
        timeoutMs: 1000,
      };
      const result = await runProductionSmokeCheck({
        ...options,
        checks: firebaseAdminHealthCheckOnly(options),
        now: new Date("2026-06-17T06:00:00.000Z"),
      });

      expect(result.ok).toBe(true);
      expect(result.failed).toEqual([]);
      expect(result.passed.map((check) => check.name)).toEqual([
        "firebase-admin-health",
      ]);
    });

    it("fails when subscription/check returns 503 (Firebase Admin SDK not initialized)", async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ error: "認証サービスが利用できません" }, 503)
      );

      const options = {
        baseUrl: "https://kabu-ana.com",
        fetchImpl,
        timeoutMs: 1000,
      };
      const result = await runProductionSmokeCheck({
        ...options,
        checks: firebaseAdminHealthCheckOnly(options),
        now: new Date("2026-06-17T06:00:00.000Z"),
      });

      expect(result.ok).toBe(false);
      expect(result.failed).toEqual([
        expect.objectContaining({
          name: "firebase-admin-health",
          message: expect.stringContaining("FIREBASE_SERVICE_ACCOUNT_KEY"),
        }),
      ]);
    });

    it("fails when subscription/check returns 500 (Firebase Admin SDK not initialized)", async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ error: "サブスクリプション状態の確認に失敗しました" }, 500)
      );

      const options = {
        baseUrl: "https://kabu-ana.com",
        fetchImpl,
        timeoutMs: 1000,
      };
      const result = await runProductionSmokeCheck({
        ...options,
        checks: firebaseAdminHealthCheckOnly(options),
        now: new Date("2026-06-17T06:00:00.000Z"),
      });

      expect(result.ok).toBe(false);
      expect(result.failed).toEqual([
        expect.objectContaining({
          name: "firebase-admin-health",
          message: expect.stringContaining("FIREBASE_SERVICE_ACCOUNT_KEY"),
        }),
      ]);
    });

    it("fails when subscription/check returns 400 (probe itself is malformed, not a config issue)", async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ error: "idTokenが必要です" }, 400)
      );

      const options = {
        baseUrl: "https://kabu-ana.com",
        fetchImpl,
        timeoutMs: 1000,
      };
      const result = await runProductionSmokeCheck({
        ...options,
        checks: firebaseAdminHealthCheckOnly(options),
        now: new Date("2026-06-17T06:00:00.000Z"),
      });

      expect(result.ok).toBe(false);
      expect(result.failed).toEqual([
        expect.objectContaining({
          name: "firebase-admin-health",
          message: expect.stringContaining("probe malfunction"),
        }),
      ]);
    });
  });
});
