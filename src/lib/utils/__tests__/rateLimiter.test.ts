import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { checkRateLimit, withRateLimit } from "../rateLimiter";

// rateLimiter.ts の既定値（実装は変更しないため、現行値をテスト内に固定値として仕様化する）
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 100;

// requestCounts はモジュールスコープの Map で全テスト間に状態が残るため、
// テストごとに一意のIPを払い出して干渉を避ける。
let ipSeq = 0;
function uniqueIp(): string {
  ipSeq += 1;
  return `203.0.113.${ipSeq}`;
}

function createRequest(ip: string, path: string = "/api/test"): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: { "x-forwarded-for": ip },
  });
}

// XFF/X-Real-IPどちらも持たないリクエスト（"unknown"IPにフォールバックする）
function createRequestWithoutIP(path: string = "/api/test"): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("制限内（初回リクエスト）は許可し、残り回数を1減らす", () => {
    const ip = uniqueIp();

    const result = checkRateLimit(createRequest(ip));

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(MAX_REQUESTS - 1);
    expect(result.resetTime).toBe(Date.now() + WINDOW_MS);
  });

  it("ウィンドウ内でmaxRequestsに達すると以降のリクエストを拒否する", () => {
    const ip = uniqueIp();

    for (let i = 0; i < MAX_REQUESTS; i++) {
      const result = checkRateLimit(createRequest(ip));
      expect(result.allowed).toBe(true);
    }

    const blocked = checkRateLimit(createRequest(ip));
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("ウィンドウ経過後は同一IPでもカウントがリセットされる", () => {
    const ip = uniqueIp();

    for (let i = 0; i < MAX_REQUESTS; i++) {
      checkRateLimit(createRequest(ip));
    }
    expect(checkRateLimit(createRequest(ip)).allowed).toBe(false);

    vi.advanceTimersByTime(WINDOW_MS + 1);

    const afterReset = checkRateLimit(createRequest(ip));
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(MAX_REQUESTS - 1);
  });

  it("同一IPでもルートパスが異なればバケットは分離される（あるルートの枯渇が他ルートに波及しない）", () => {
    const ip = uniqueIp();

    for (let i = 0; i < MAX_REQUESTS; i++) {
      const result = checkRateLimit(createRequest(ip, "/api/a"));
      expect(result.allowed).toBe(true);
    }
    expect(checkRateLimit(createRequest(ip, "/api/a")).allowed).toBe(false);

    const resultOnOtherRoute = checkRateLimit(createRequest(ip, "/api/b"));
    expect(resultOnOtherRoute.allowed).toBe(true);
    expect(resultOnOtherRoute.remaining).toBe(MAX_REQUESTS - 1);
  });

  it("同一ルートパスでもIPが異なればバケットは分離される（既存テストの暗黙依存の明示化）", () => {
    const ipA = uniqueIp();
    const ipB = uniqueIp();
    const path = "/api/ip-isolation";

    for (let i = 0; i < MAX_REQUESTS; i++) {
      checkRateLimit(createRequest(ipA, path));
    }
    expect(checkRateLimit(createRequest(ipA, path)).allowed).toBe(false);

    const resultForIpB = checkRateLimit(createRequest(ipB, path));
    expect(resultForIpB.allowed).toBe(true);
    expect(resultForIpB.remaining).toBe(MAX_REQUESTS - 1);
  });

  it('XFF/X-Real-IPが無いリクエストは"unknown"にフォールバックする（送信元不明なリクエスト同士は同一パス内で1バケットを共有する現仕様の固定化。攻撃対策としては不十分でRedis化/認証キー化はP2）', () => {
    const path = "/api/unknown-ip-fallback";

    const first = checkRateLimit(createRequestWithoutIP(path));
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(MAX_REQUESTS - 1);

    const second = checkRateLimit(createRequestWithoutIP(path));
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(MAX_REQUESTS - 2);
  });
});

describe("withRateLimit", () => {
  it("制限内であればハンドラーを呼び出し、レート制限ヘッダーを付与する", async () => {
    const ip = uniqueIp();
    const handler = vi.fn(async () => new Response("ok", { status: 200 }));
    const wrapped = withRateLimit(handler);

    const response = await wrapped(createRequest(ip));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-RateLimit-Limit")).toBe(
      MAX_REQUESTS.toString()
    );
    expect(response.headers.get("X-RateLimit-Remaining")).toBe(
      (MAX_REQUESTS - 1).toString()
    );
  });

  it("制限超過時は429を返し、ハンドラーを呼び出さない", async () => {
    const ip = uniqueIp();
    const handler = vi.fn(async () => new Response("ok", { status: 200 }));
    const wrapped = withRateLimit(handler);

    for (let i = 0; i < MAX_REQUESTS; i++) {
      await wrapped(createRequest(ip));
    }
    handler.mockClear();

    const response = await wrapped(createRequest(ip));

    expect(response.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
    expect(response.headers.get("Retry-After")).toBeTruthy();

    const body = await response.json();
    expect(body.error).toContain("レート制限");
  });
});
