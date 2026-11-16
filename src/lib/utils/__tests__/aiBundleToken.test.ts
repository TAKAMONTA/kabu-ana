import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeFirestore } from "@/lib/__tests__/fakeFirestore";

const getAdminAppMock = vi.fn();
let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/firebase/admin")>(
      "@/lib/firebase/admin"
    );
  return { ...actual, getAdminApp: () => getAdminAppMock() };
});

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => db,
}));

import {
  AI_BUNDLE_TOKENS_COLLECTION,
  createAiBundleToken,
  createBundledSkip,
  resetBundleTokenMemoryForTests,
  verifyAiBundleToken,
} from "../aiBundleToken";
import { FirebaseAdminConfigError } from "@/lib/firebase/admin";

const IP = "198.51.100.7";
const ENV_KEYS = ["AI_BUNDLE_TOKEN_SECRET", "OPENROUTER_API_KEY"] as const;
const originalEnv = new Map(ENV_KEYS.map(key => [key, process.env[key]]));

function requestWith(token: string | null, symbol: unknown, ip = IP) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": ip,
  };
  if (token) headers["x-ai-bundle-token"] = token;
  return new NextRequest("http://localhost/api/financial-evaluation", {
    method: "POST",
    headers,
    body: JSON.stringify({ symbol, companyName: "トヨタ自動車" }),
  });
}

describe("AI bundle token", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.AI_BUNDLE_TOKEN_SECRET = "bundle-secret-for-tests";
    delete process.env.OPENROUTER_API_KEY;
    db = new FakeFirestore();
    getAdminAppMock.mockReset();
    getAdminAppMock.mockReturnValue({});
    resetBundleTokenMemoryForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    for (const key of ENV_KEYS) {
      const value = originalEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("exempts the matching follow-up call exactly once", async () => {
    const token = createAiBundleToken(IP, "7203", "financial")!;
    const skip = createBundledSkip("financial");

    await expect(skip(requestWith(token, "7203"))).resolves.toBe(true);
    // 同じトークンの再送（リプレイ）は拒否する
    await expect(skip(requestWith(token, "7203"))).resolves.toBe(false);
  });

  it("rejects replays across instances (Firestore remembers used tokens)", async () => {
    const token = createAiBundleToken(IP, "7203", "news")!;
    const skip = createBundledSkip("news");

    await expect(skip(requestWith(token, "7203"))).resolves.toBe(true);
    resetBundleTokenMemoryForTests(); // 別インスタンスを模す
    await expect(skip(requestWith(token, "7203"))).resolves.toBe(false);
    expect(
      [...db.docs.keys()].some(path =>
        path.startsWith(`${AI_BUNDLE_TOKENS_COLLECTION}/`)
      )
    ).toBe(true);
  });

  it("is bound to the analysed symbol (another stock cannot reuse it)", async () => {
    const token = createAiBundleToken(IP, "7203", "financial")!;
    const skip = createBundledSkip("financial");

    await expect(skip(requestWith(token, "6758"))).resolves.toBe(false);
    // 表記ゆれ（前後空白・大小文字）は同じ銘柄として扱う
    const usToken = createAiBundleToken(IP, "aapl", "financial")!;
    await expect(skip(requestWith(usToken, " AAPL "))).resolves.toBe(true);
  });

  it("is bound to the action and the client IP", async () => {
    const token = createAiBundleToken(IP, "7203", "financial")!;

    await expect(
      createBundledSkip("news")(requestWith(token, "7203"))
    ).resolves.toBe(false);
    await expect(
      createBundledSkip("financial")(requestWith(token, "7203", "192.0.2.1"))
    ).resolves.toBe(false);
  });

  it("rejects tampered or malformed signatures without throwing", () => {
    const token = createAiBundleToken(IP, "7203", "financial")!;
    const [payload, signature] = token.split(".");
    // 長さは同じで1文字だけ違う署名
    const flipped = `${payload}.${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;
    const request = requestWith(null, "7203");

    expect(verifyAiBundleToken(flipped, request, "financial", "7203")).toBeNull();
    expect(verifyAiBundleToken(`${payload}.short`, request, "financial", "7203")).toBeNull();
    expect(verifyAiBundleToken("garbage", request, "financial", "7203")).toBeNull();
    expect(verifyAiBundleToken(`${payload}.${signature}`, request, "financial", "7203")).not.toBeNull();
  });

  it("expires after 15 minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-15T00:00:00.000Z"));
    const token = createAiBundleToken(IP, "7203", "financial")!;
    vi.setSystemTime(new Date("2026-11-15T00:16:00.000Z"));

    await expect(
      createBundledSkip("financial")(requestWith(token, "7203"))
    ).resolves.toBe(false);
  });

  it("fails closed (counts normally) when Firestore is unavailable", async () => {
    getAdminAppMock.mockImplementation(() => {
      throw new FirebaseAdminConfigError("FIREBASE_SERVICE_ACCOUNT_KEY が設定されていません");
    });
    const token = createAiBundleToken(IP, "7203", "financial")!;

    await expect(
      createBundledSkip("financial")(requestWith(token, "7203"))
    ).resolves.toBe(false);
  });

  it("falls back to OPENROUTER_API_KEY as the signing key, and disables bundling with no key at all", () => {
    delete process.env.AI_BUNDLE_TOKEN_SECRET;
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    expect(createAiBundleToken(IP, "7203", "financial")).toEqual(expect.any(String));

    delete process.env.OPENROUTER_API_KEY;
    // 以前は固定文字列 "dev-ai-bundle-secret" で署名しており、誰でも偽造できた
    expect(createAiBundleToken(IP, "7203", "financial")).toBeNull();

    process.env.AI_BUNDLE_TOKEN_SECRET = "your_ai_bundle_token_secret_here";
    expect(createAiBundleToken(IP, "7203", "financial")).toBeNull();
  });
});
