import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeFirestore, SERVER_TIMESTAMP } from "@/lib/__tests__/fakeFirestore";

const getAdminAppMock = vi.fn();
let db = new FakeFirestore();

vi.mock("@/lib/firebase/admin", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/firebase/admin")>(
      "@/lib/firebase/admin"
    );
  return { ...actual, getAdminApp: () => getAdminAppMock() };
});

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => db,
  FieldValue: { serverTimestamp: () => SERVER_TIMESTAMP },
}));

import { GET as getPrices } from "../prices/route";
import { GET as getSeismic } from "../seismic/route";
import { GET as getNews } from "../news/route";
import { GET as getRisk } from "../risk/route";
import { GET as getCron } from "../cron/refresh/route";
import { FirebaseAdminConfigError } from "@/lib/firebase/admin";
import {
  PREVIOUS_SIGNAL_ID,
  previousDayId,
  SIGNAL_FETCH_FAILED_MESSAGE,
  SIGNAL_NOT_CONFIGURED_MESSAGE,
  todayId,
} from "@/lib/signals/cache";

const ENV_KEYS = [
  "EIA_API_KEY",
  "FRED_API_KEY",
  "CRON_SECRET",
  "SIGNALS_CRON_SECRET",
] as const;
const originalEnv = new Map(ENV_KEYS.map(key => [key, process.env[key]]));

function noFirestore() {
  getAdminAppMock.mockImplementation(() => {
    throw new FirebaseAdminConfigError(
      "FIREBASE_SERVICE_ACCOUNT_KEY が設定されていません"
    );
  });
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  db = new FakeFirestore();
  getAdminAppMock.mockReset();
  getAdminAppMock.mockReturnValue({});
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const key of ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("signals endpoints never leak env var names or raw errors", () => {
  it("prices: missing API keys → fixed 'not ready' message", async () => {
    noFirestore();
    const text = await (await getPrices()).text();
    expect(text).not.toContain("EIA_API_KEY");
    expect(text).not.toContain("FRED_API_KEY");
    expect(JSON.parse(text)).toEqual({ data: null, error: SIGNAL_NOT_CONFIGURED_MESSAGE });
  });

  it("prices: upstream failure → fixed message, keeps the last good data", async () => {
    process.env.EIA_API_KEY = "eia";
    process.env.FRED_API_KEY = "fred";
    db.seed(`signals_prices/${PREVIOUS_SIGNAL_ID}`, {
      prices: [{ key: "wti" }],
      fetchedAt: "2026-11-14T00:00:00.000Z",
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 403 })));

    const body = await (await getPrices()).json();
    expect(body.error).toBe(SIGNAL_FETCH_FAILED_MESSAGE);
    expect(body.data.prices).toEqual([{ key: "wti" }]);
    expect(body.lastSuccessfulAt).toBe("2026-11-14T00:00:00.000Z");
  });

  it("seismic: network failure → fixed message instead of 'fetch failed'", async () => {
    noFirestore();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );
    const text = await (await getSeismic()).text();
    expect(text).not.toContain("fetch failed");
    expect(JSON.parse(text).error).toBe(SIGNAL_FETCH_FAILED_MESSAGE);
  });

  it("news: all feeds failing does not overwrite the last good data with zero items", async () => {
    db.seed(`signals_news/${PREVIOUS_SIGNAL_ID}`, {
      items: [{ title: "old", score: 1 }],
      fetchedAt: "2026-11-14T00:00:00.000Z",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );

    const body = await (await getNews()).json();
    expect(body.error).toBe(SIGNAL_FETCH_FAILED_MESSAGE);
    expect(body.data.items[0].title).toBe("old");
    expect(db.docs.get(`signals_news/${PREVIOUS_SIGNAL_ID}`)?.items).toHaveLength(1);
    expect(db.docs.has(`signals_news/${todayId()}`)).toBe(false);
  });
});

describe("GET /api/signals/risk", () => {
  function seedInputs() {
    db.seed(`signals_prices/${todayId()}`, {
      prices: [
        { key: "wti", change24h: 1.5 },
        { key: "brent", change24h: 1.2 },
      ],
    });
    db.seed(`signals_news/${todayId()}`, {
      items: [
        {
          title: "Hormuz tanker attacked",
          summary: "",
          score: 8,
          publishedAt: new Date().toISOString(),
        },
      ],
    });
  }

  it("returns a fixed message and writes nothing when there are no inputs at all", async () => {
    const body = await (await getRisk()).json();
    expect(body.error).toBe(SIGNAL_FETCH_FAILED_MESSAGE);
    expect(db.docs.has(`signals_risk/${todayId()}`)).toBe(false);
  });

  it("compares the composite with yesterday's (JST) result, not the previous request", async () => {
    seedInputs();
    db.seed(`signals_risk/${previousDayId(todayId())}`, { composite: -100 });

    const body = await (await getRisk()).json();
    expect(
      body.data.anomalies.some((a: { label: string }) => a.label === "Composite")
    ).toBe(true);
    expect(body.data.dateId).toBe(todayId());
    // 2回目以降のリクエストでも比較元は前日のまま（直前の計算結果ではない）
    const again = await (await getRisk()).json();
    expect(
      again.data.anomalies.some((a: { label: string }) => a.label === "Composite")
    ).toBe(true);
    expect(db.docs.has(`signals_risk/${PREVIOUS_SIGNAL_ID}`)).toBe(false);
  });

  it("ignores the old per-request 'previous' doc when yesterday has no result", async () => {
    seedInputs();
    db.seed(`signals_risk/${PREVIOUS_SIGNAL_ID}`, { composite: -100 });

    const body = await (await getRisk()).json();
    expect(
      body.data.anomalies.some((a: { label: string }) => a.label === "Composite")
    ).toBe(false);
  });
});

describe("GET /api/signals/cron/refresh", () => {
  function cronRequest(authorization?: string) {
    return new NextRequest("http://localhost/api/signals/cron/refresh", {
      headers: authorization ? { Authorization: authorization } : {},
    });
  }

  it("rejects requests without the secret", async () => {
    process.env.CRON_SECRET = "test";
    expect((await getCron(cronRequest())).status).toBe(401);
    expect((await getCron(cronRequest("Bearer wrong"))).status).toBe(401);
  });

  it("accepts Vercel's Authorization: Bearer $CRON_SECRET", async () => {
    process.env.CRON_SECRET = "test";
    const fetchMock = vi.fn(async () => Response.json({ data: null }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await getCron(cronRequest("Bearer test"));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("still accepts the legacy SIGNALS_CRON_SECRET and survives failing internal calls", async () => {
    process.env.SIGNALS_CRON_SECRET = "legacy";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );

    const response = await getCron(cronRequest("Bearer legacy"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.results.every((r: { status: number }) => r.status === 0)).toBe(true);
  });
});
