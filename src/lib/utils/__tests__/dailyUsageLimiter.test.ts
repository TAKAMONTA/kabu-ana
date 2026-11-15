import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getAdminAppMock = vi.fn();
const verifyIdTokenMock = vi.fn();
const subscriptionDataMock = vi.fn();

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: verifyIdTokenMock }),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => {
          const data = subscriptionDataMock();
          return { exists: data !== undefined, data: () => data };
        },
      }),
    }),
  }),
}));

vi.mock("@/lib/firebase/admin", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/firebase/admin")>(
      "@/lib/firebase/admin"
    );
  return {
    ...actual,
    getAdminApp: (...args: unknown[]) => getAdminAppMock(...args),
  };
});

import {
  checkPremiumStatus,
  markNotCountable,
  resetDailyUsageForTests,
  USAGE_COUNTABLE_HEADER,
  withDailyLimit,
} from "../dailyUsageLimiter";
import { FirebaseAdminConfigError } from "@/lib/firebase/admin";

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/test", { headers });
}

describe("checkPremiumStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when there is no bearer token", async () => {
    const result = await checkPremiumStatus(makeRequest());
    expect(result).toBe(false);
    expect(getAdminAppMock).not.toHaveBeenCalled();
  });

  it("returns false and logs when Firebase Admin SDK has a config error (fail-closed, but traceable)", async () => {
    getAdminAppMock.mockImplementation(() => {
      throw new FirebaseAdminConfigError(
        "FIREBASE_SERVICE_ACCOUNT_KEY が設定されていません"
      );
    });
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await checkPremiumStatus(
      makeRequest({ authorization: "Bearer some-token" })
    );

    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedMessages = consoleErrorSpy.mock.calls.map((call) =>
      call.join(" ")
    );
    expect(
      loggedMessages.some((message) => message.includes("Firebase Admin"))
    ).toBe(true);

    consoleErrorSpy.mockRestore();
  });
});

describe("checkPremiumStatus with a subscription document", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminAppMock.mockReturnValue({});
    verifyIdTokenMock.mockResolvedValue({ uid: "user-1" });
  });

  it("treats a cancelled web subscription as premium until its end date", async () => {
    subscriptionDataMock.mockReturnValue({
      status: "cancelled",
      platform: "web",
      expiryDate: { toDate: () => new Date(Date.now() + 86_400_000) },
    });
    await expect(
      checkPremiumStatus(makeRequest({ authorization: "Bearer token" }))
    ).resolves.toBe(true);
  });

  it("treats an expired active subscription as free", async () => {
    subscriptionDataMock.mockReturnValue({
      status: "active",
      expiryDate: { toDate: () => new Date(Date.now() - 86_400_000) },
    });
    await expect(
      checkPremiumStatus(makeRequest({ authorization: "Bearer token" }))
    ).resolves.toBe(false);
  });
});

describe("withDailyLimit", () => {
  let ipCounter = 0;
  let ip = "";

  /** 無料ユーザー（Authorization 無し）としてのリクエスト */
  function freeRequest() {
    return new NextRequest("http://localhost/api/test", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
    });
  }

  beforeEach(() => {
    resetDailyUsageForTests();
    ipCounter += 1;
    ip = `203.0.113.${ipCounter}`;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reserves usage before running the handler so parallel requests cannot exceed the limit", async () => {
    let calls = 0;
    const handler = vi.fn(async () => {
      calls += 1;
      // ハンドラー実行中（AI呼び出し待ち）に他のリクエストが割り込む状況を作る
      await new Promise(resolve => setTimeout(resolve, 5));
      return new Response("{}", { status: 200 });
    });
    const limited = withDailyLimit(handler);

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => limited(freeRequest()))
    );

    expect(responses.filter(r => r.status === 200)).toHaveLength(5);
    expect(responses.filter(r => r.status === 403)).toHaveLength(5);
    expect(calls).toBe(5);
  });

  it("returns the reservation when the handler fails (non-2xx or throws)", async () => {
    const failing = withDailyLimit(async () => new Response("{}", { status: 500 }));
    const throwing = withDailyLimit(async () => {
      throw new Error("boom");
    });
    for (let i = 0; i < 6; i++) {
      expect((await failing(freeRequest())).status).toBe(500);
    }
    await expect(throwing(freeRequest())).rejects.toThrow("boom");

    const ok = withDailyLimit(async () => new Response("{}", { status: 200 }));
    for (let i = 0; i < 5; i++) {
      expect((await ok(freeRequest())).status).toBe(200);
    }
    expect((await ok(freeRequest())).status).toBe(403);
  });

  it("does not count responses marked X-Usage-Countable: false and strips the header", async () => {
    const notCountable = withDailyLimit(async () =>
      markNotCountable(Response.json({ empty: true }))
    );
    for (let i = 0; i < 7; i++) {
      const response = await notCountable(freeRequest());
      expect(response.status).toBe(200);
      expect(response.headers.get(USAGE_COUNTABLE_HEADER)).toBeNull();
      expect(await response.json()).toEqual({ empty: true });
    }

    const ok = withDailyLimit(async () => new Response("{}", { status: 200 }));
    const first = await ok(freeRequest());
    expect(first.status).toBe(200);
    expect(first.headers.get("X-Daily-Remaining")).toBe("4");
  });

  it("does not count requests that the skip option exempts", async () => {
    const skipped = withDailyLimit(
      async () => new Response("{}", { status: 200 }),
      { skip: async () => true }
    );
    for (let i = 0; i < 8; i++) {
      expect((await skipped(freeRequest())).status).toBe(200);
    }
  });

  it("resets the free quota at midnight JST, not at 09:00 JST (00:00 UTC)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const ok = withDailyLimit(async () => new Response("{}", { status: 200 }));

    // 2026-11-14 23:00 JST（= 14:00 UTC）に上限まで使う
    vi.setSystemTime(new Date("2026-11-14T14:00:00.000Z"));
    for (let i = 0; i < 5; i++) {
      expect((await ok(freeRequest())).status).toBe(200);
    }
    expect((await ok(freeRequest())).status).toBe(403);

    // 2026-11-15 00:01 JST（UTC ではまだ 11-14）に枠が戻る
    vi.setSystemTime(new Date("2026-11-14T15:01:00.000Z"));
    expect((await ok(freeRequest())).status).toBe(200);
  });
});
