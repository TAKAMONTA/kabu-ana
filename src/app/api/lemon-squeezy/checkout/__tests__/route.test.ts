import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getAdminAppMock = vi.fn();
const verifyIdTokenMock = vi.fn();
const getAuthMock = vi.fn((_app?: unknown) => ({
  verifyIdToken: verifyIdTokenMock,
}));
const createCheckoutMock = vi.fn();

vi.mock("@/lib/firebase/admin", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/firebase/admin")>(
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

vi.mock("@/lib/lemon-squeezy", () => ({
  createCheckout: (...args: unknown[]) => createCheckoutMock(...args),
}));

import { POST } from "../route";
import { FirebaseAdminConfigError } from "@/lib/firebase/admin";

function postCheckout(body: unknown) {
  const request = new NextRequest(
    "http://localhost/api/lemon-squeezy/checkout",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return POST(request);
}

describe("POST /api/lemon-squeezy/checkout", () => {
  const originalEnv = {
    LEMON_SQUEEZY_API_KEY: process.env.LEMON_SQUEEZY_API_KEY,
    LEMON_SQUEEZY_STORE_ID: process.env.LEMON_SQUEEZY_STORE_ID,
    LEMON_SQUEEZY_VARIANT_ID_MONTHLY:
      process.env.LEMON_SQUEEZY_VARIANT_ID_MONTHLY,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LEMON_SQUEEZY_API_KEY = "test-api-key";
    process.env.LEMON_SQUEEZY_STORE_ID = "test-store-id";
    process.env.LEMON_SQUEEZY_VARIANT_ID_MONTHLY = "test-variant-id";
    createCheckoutMock.mockResolvedValue({
      data: {
        id: "1",
        type: "checkouts",
        attributes: { url: "https://checkout.example/session" },
      },
    });
  });

  afterEach(() => {
    process.env.LEMON_SQUEEZY_API_KEY = originalEnv.LEMON_SQUEEZY_API_KEY;
    process.env.LEMON_SQUEEZY_STORE_ID = originalEnv.LEMON_SQUEEZY_STORE_ID;
    process.env.LEMON_SQUEEZY_VARIANT_ID_MONTHLY =
      originalEnv.LEMON_SQUEEZY_VARIANT_ID_MONTHLY;
  });

  it("returns 503 without calling createCheckout when Firebase Admin SDK is misconfigured", async () => {
    // 2026-08-16と同種の障害の再発防止: 設定エラーをゲスト購入に握り潰すと、
    // ログイン済みユーザーの購入がuserId無しで成立してしまう。
    getAdminAppMock.mockImplementation(() => {
      throw new FirebaseAdminConfigError(
        "FIREBASE_SERVICE_ACCOUNT_KEY が設定されていません"
      );
    });

    const response = await postCheckout({
      idToken: "some-token",
      planType: "monthly",
    });

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe("認証サービスが利用できません");
    expect(createCheckoutMock).not.toHaveBeenCalled();
  });

  it("proceeds as a guest checkout when the token is invalid (existing behavior preserved)", async () => {
    getAdminAppMock.mockReturnValue({ name: "[DEFAULT]" });
    verifyIdTokenMock.mockRejectedValue(new Error("invalid token"));

    const response = await postCheckout({
      idToken: "bad-token",
      planType: "monthly",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.checkoutUrl).toBe("https://checkout.example/session");
    expect(createCheckoutMock).toHaveBeenCalledTimes(1);
    const callArgs = createCheckoutMock.mock.calls[0][0];
    expect(callArgs.customData.userId).toBeUndefined();
  });
});
