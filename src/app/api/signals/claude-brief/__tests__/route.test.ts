import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  FakeFirestore,
  incrementSentinel,
  SERVER_TIMESTAMP,
} from "@/lib/__tests__/fakeFirestore";

const getAdminAppMock = vi.fn();
const verifyIdTokenMock = vi.fn();
const getAuthMock = vi.fn((_app?: unknown) => ({
  verifyIdToken: verifyIdTokenMock,
}));
const axiosPostMock = vi.fn();
let db = new FakeFirestore();

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => db,
  FieldValue: {
    serverTimestamp: () => SERVER_TIMESTAMP,
    increment: (n: number) => incrementSentinel(n),
  },
}));

vi.mock("axios", () => ({
  default: {
    post: (...args: unknown[]) => axiosPostMock(...args),
    isAxiosError: () => false,
  },
}));

vi.mock("@/lib/firebase/admin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/firebase/admin")>(
    "@/lib/firebase/admin"
  );
  return {
    ...actual,
    getAdminApp: () => getAdminAppMock(),
  };
});

vi.mock("firebase-admin/auth", () => ({
  getAuth: (app: unknown) => getAuthMock(app),
}));

vi.mock("@/lib/utils/rateLimiter", () => ({
  withRateLimit: (handler: (request: NextRequest) => Promise<Response>) =>
    handler,
}));

import { GET, POST } from "../route";
import { FirebaseAdminConfigError } from "@/lib/firebase/admin";
import {
  previousDayId,
  SIGNAL_NOT_CONFIGURED_MESSAGE,
  todayId,
} from "@/lib/signals/cache";

function postClaudeBrief(headers: Record<string, string> = {}) {
  const request = new NextRequest("http://localhost/api/signals/claude-brief", {
    method: "POST",
    headers,
  });
  return POST(request);
}

describe("POST /api/signals/claude-brief", () => {
  const originalExportStatic = process.env.EXPORT_STATIC;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.EXPORT_STATIC;
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    if (originalExportStatic === undefined) {
      delete process.env.EXPORT_STATIC;
    } else {
      process.env.EXPORT_STATIC = originalExportStatic;
    }
  });

  it("returns 503 without disguising a Firebase Admin config error as a login problem", async () => {
    getAdminAppMock.mockImplementation(() => {
      throw new FirebaseAdminConfigError(
        "FIREBASE_SERVICE_ACCOUNT_KEY が設定されていません"
      );
    });

    const response = await postClaudeBrief({ Authorization: "Bearer x" });

    expect(response.status).toBe(503);
    const bodyText = await response.text();
    expect(bodyText).not.toContain("ログイン");
    expect(JSON.parse(bodyText)).toEqual({
      error: "認証サービスが利用できません",
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "verifyAuth: Firebase Admin SDKの設定エラー"
    );
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const response = await postClaudeBrief();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "認証が必要です。ログインしてください。" });
    expect(getAdminAppMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the ID token fails verification (Admin SDK itself is healthy)", async () => {
    getAdminAppMock.mockReturnValue({ name: "[DEFAULT]" });
    verifyIdTokenMock.mockRejectedValue(new Error("invalid token"));

    const response = await postClaudeBrief({
      Authorization: "Bearer bad-token",
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({
      error: "認証に失敗しました。再ログインしてください。",
    });
  });
});

const BRIEF = {
  headline_jp: "原油高を警戒",
  summary_jp: "中東情勢で原油が上昇。",
  key_drivers: [{ factor: "原油", impact: "上昇" }],
  stocks_to_watch: [{ ticker: "1605", reason: "原油高", direction: "up" }],
  risk_outlook: "elevated",
};

function aiReply(content: unknown) {
  return {
    data: {
      choices: [{ message: { content: JSON.stringify(content) } }],
    },
  };
}

function getBrief() {
  return GET(new NextRequest("http://localhost/api/signals/claude-brief"));
}

function postDeepDive(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/signals/claude-brief", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid",
        "content-type": "application/json",
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

describe("GET /api/signals/claude-brief (once per JST day)", () => {
  const originalKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    db = new FakeFirestore();
    getAdminAppMock.mockReturnValue({});
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: null }))
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
  });

  it("returns today's brief without calling the AI, even when source data is newer", async () => {
    // 以前は news/prices の fetchedAt がブリーフより新しいだけで再生成（課金）していた
    db.seed(`signals_brief/${todayId()}`, {
      brief: BRIEF,
      generatedAt: "2026-11-14T21:00:00.000Z",
    });
    db.seed(`signals_news/${todayId()}`, {
      fetchedAt: new Date().toISOString(),
      items: [{ score: 5 }],
    });

    const response = await getBrief();

    expect(axiosPostMock).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      data: { brief: BRIEF, generatedAt: "2026-11-14T21:00:00.000Z" },
      lastSuccessfulAt: "2026-11-14T21:00:00.000Z",
    });
  });

  it("calls the AI only once even when several requests arrive at the same time", async () => {
    db.seed(`signals_news/${todayId()}`, {
      fetchedAt: new Date().toISOString(),
      items: [{ title: "Hormuz", score: 7 }],
    });
    axiosPostMock.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return aiReply(BRIEF);
    });

    const responses = await Promise.all([getBrief(), getBrief(), getBrief()]);
    const bodies = await Promise.all(responses.map(r => r.json()));

    expect(axiosPostMock).toHaveBeenCalledTimes(1);
    expect(bodies.filter(body => body.data?.brief)).toHaveLength(1);
    expect(
      bodies.filter(body => typeof body.error === "string" && body.error.includes("作成中"))
    ).toHaveLength(2);

    // 生成後は何度呼んでも AI を呼ばない
    const later = await (await getBrief()).json();
    expect(later.data.brief.headline_jp).toBe(BRIEF.headline_jp);
    expect(axiosPostMock).toHaveBeenCalledTimes(1);
  });

  it("returns a fixed message (no env var names) when OpenRouter is not configured", async () => {
    delete process.env.OPENROUTER_API_KEY;
    db.seed(`signals_news/${todayId()}`, { items: [{ score: 5 }] });

    const response = await getBrief();
    const text = await response.text();

    expect(axiosPostMock).not.toHaveBeenCalled();
    expect(text).not.toContain("OPENROUTER");
    expect(JSON.parse(text).error).toBe(SIGNAL_NOT_CONFIGURED_MESSAGE);
  });

  it("hides AI error details and falls back to yesterday's brief", async () => {
    db.seed(`signals_news/${todayId()}`, { items: [{ score: 5 }] });
    db.seed(`signals_brief/${previousDayId(todayId())}`, {
      brief: BRIEF,
      generatedAt: "2026-11-13T21:00:00.000Z",
      status: "ready",
    });
    axiosPostMock.mockRejectedValue(
      new Error("Request failed with status code 401: invalid key sk-or-test")
    );

    const response = await getBrief();
    const text = await response.text();
    const body = JSON.parse(text);

    expect(text).not.toContain("status code");
    expect(text).not.toContain("sk-or-test");
    expect(body.error).toContain("作成できませんでした");
    expect(body.data).toEqual({
      brief: BRIEF,
      generatedAt: "2026-11-13T21:00:00.000Z",
    });
    expect(db.docs.get(`signals_brief/${todayId()}`)).toMatchObject({
      status: "error",
      attempts: 1,
    });
  });

  it("does not call the AI when Firestore is unavailable (no lock = no generation)", async () => {
    getAdminAppMock.mockImplementation(() => {
      throw new FirebaseAdminConfigError(
        "FIREBASE_SERVICE_ACCOUNT_KEY が設定されていません"
      );
    });

    const body = await (await getBrief()).json();

    expect(axiosPostMock).not.toHaveBeenCalled();
    expect(body.error).toBe(SIGNAL_NOT_CONFIGURED_MESSAGE);
  });
});

describe("POST /api/signals/claude-brief (deep dive)", () => {
  const originalKey = process.env.OPENROUTER_API_KEY;
  const DEEP_DIVE = {
    causes: [1, 2, 3].map(i => ({ hypothesis: `h${i}`, rationale: `r${i}` })),
    scenarios: [1, 2, 3].map(i => ({ scenario: `s${i}`, trigger: `t${i}` })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    db = new FakeFirestore();
    getAdminAppMock.mockReturnValue({});
    verifyIdTokenMock.mockResolvedValue({ uid: "user-1" });
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    db.seed("subscriptions/user-1", { status: "active", platform: "ios" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
  });

  it("rejects an invalid or oversized body with 400 and no validation dump", async () => {
    for (const body of [
      "{not json",
      { brief: { headline_jp: 1 } },
      { brief: { headline_jp: "x", summary_jp: "y".repeat(5000) } },
    ]) {
      const response = await postDeepDive(body);
      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).not.toContain("expected");
      expect(JSON.parse(text).error).toBe("リクエストの形式が正しくありません");
    }
    expect(axiosPostMock).not.toHaveBeenCalled();
  });

  it("returns the deep dive for a premium user and counts the use", async () => {
    axiosPostMock.mockResolvedValue(aiReply(DEEP_DIVE));

    const body = await (await postDeepDive({ brief: BRIEF })).json();

    expect(body.data).toEqual(DEEP_DIVE);
    expect(db.docs.get(`signals_claude_usage/user-1_${todayId()}`)).toMatchObject({
      userId: "user-1",
      count: 1,
    });
  });

  it("refuses once the daily limit is reached without calling the AI", async () => {
    db.seed(`signals_claude_usage/user-1_${todayId()}`, { userId: "user-1", count: 10 });

    const body = await (await postDeepDive({ brief: BRIEF })).json();

    expect(body.error).toBe("本日の深掘り分析上限に達しました");
    expect(axiosPostMock).not.toHaveBeenCalled();
  });

  it("gives the use back and hides details when the AI call fails", async () => {
    db.seed(`signals_claude_usage/user-1_${todayId()}`, { userId: "user-1", count: 3 });
    axiosPostMock.mockRejectedValue(new Error("socket hang up at openrouter.ai"));

    const response = await postDeepDive({ brief: BRIEF });
    const text = await response.text();

    expect(text).not.toContain("socket hang up");
    expect(JSON.parse(text).error).toBe(
      "深掘り分析に失敗しました。時間をおいて再度お試しください。"
    );
    expect(db.docs.get(`signals_claude_usage/user-1_${todayId()}`)?.count).toBe(3);
  });
});
