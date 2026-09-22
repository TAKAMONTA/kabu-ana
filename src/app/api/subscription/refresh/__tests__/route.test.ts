import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getAdminAppMock = vi.fn();
const getFirestoreMock = vi.fn();

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

vi.mock("@/lib/auth/verifyAuth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/verifyAuth")>(
      "@/lib/auth/verifyAuth"
    );
  return {
    ...actual,
    verifyAuth: () => Promise.resolve({ uid: "user-1" }),
  };
});

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => getFirestoreMock(),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

vi.mock("@/lib/purchases/nativePurchaseVerification", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/purchases/nativePurchaseVerification")
  >("@/lib/purchases/nativePurchaseVerification");
  return {
    ...actual,
    parseNativePurchaseUpdateRequest: () => ({
      idToken: "already-authenticated",
      platform: "ios" as const,
      productId: "com.takaapps.kabunavi.Monthly",
      purchaseToken: "token-1",
    }),
    verifyNativePurchase: () =>
      Promise.reject(
        new actual.PurchaseVerificationError("テスト用の購入検証エラー", 402)
      ),
  };
});

import { POST } from "../route";
import { FirebaseAdminConfigError } from "@/lib/firebase/admin";

function postRefresh() {
  const request = new NextRequest("http://localhost/api/subscription/refresh", {
    method: "POST",
    headers: { Authorization: "Bearer valid-token" },
  });
  return POST(request);
}

function makeDb(snapshotData: Record<string, unknown>, exists = true) {
  return {
    collection: () => ({
      doc: () => ({
        get: () => Promise.resolve({ exists, data: () => snapshotData }),
        set: () => Promise.resolve(),
      }),
    }),
  };
}

describe("POST /api/subscription/refresh", () => {
  beforeEach(() => {
    getAdminAppMock.mockReset();
    getFirestoreMock.mockReset();
  });

  it("returns 503 without leaking the config error detail when Firebase Admin SDK is misconfigured", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    getAdminAppMock.mockImplementation(() => {
      throw new FirebaseAdminConfigError(
        "FIREBASE_SERVICE_ACCOUNT_KEY が設定されていません"
      );
    });

    const response = await postRefresh();

    expect(response.status).toBe(503);
    const bodyText = await response.text();
    expect(bodyText).not.toContain("FIREBASE_SERVICE_ACCOUNT_KEY");
    expect(JSON.parse(bodyText)).toEqual({ error: "認証サービスが利用できません" });
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("returns 500 with a fixed message without leaking internal error detail", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    getAdminAppMock.mockReturnValue({});
    getFirestoreMock.mockImplementation(() => {
      throw new Error("internal detail: secret-xyz");
    });

    const response = await postRefresh();

    expect(response.status).toBe(500);
    const bodyText = await response.text();
    expect(bodyText).not.toContain("secret-xyz");
    expect(JSON.parse(bodyText)).toEqual({
      error: "購入状態の再検証に失敗しました",
    });
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("keeps returning the PurchaseVerificationError message and statusCode unchanged", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    getAdminAppMock.mockReturnValue({});
    getFirestoreMock.mockReturnValue(
      makeDb({
        platform: "ios",
        productId: "com.takaapps.kabunavi.Monthly",
        purchaseToken: "token-1",
      })
    );

    const response = await postRefresh();

    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body).toEqual({ error: "テスト用の購入検証エラー" });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("購入検証エラー")
    );

    consoleErrorSpy.mockRestore();
  });
});
