import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeFirestore } from "@/lib/__tests__/fakeFirestore";

const getAdminAppMock = vi.fn();
const verifyIdTokenMock = vi.fn();
let db = new FakeFirestore();

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: verifyIdTokenMock }),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => db,
}));

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

import { GET } from "../route";
import { FirebaseAdminConfigError } from "@/lib/firebase/admin";

function getSubscriptionCheck(headers: Record<string, string> = {}) {
  const request = new NextRequest("http://localhost/api/subscription/check", {
    method: "GET",
    headers,
  });
  return GET(request);
}

describe("GET /api/subscription/check", () => {
  it("returns 400 when no idToken is provided (header or query param)", async () => {
    const response = await getSubscriptionCheck();

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("idTokenが必要です");
    expect(getAdminAppMock).not.toHaveBeenCalled();
  });

  it("returns 503 without leaking the config error detail when Firebase Admin SDK is misconfigured", async () => {
    // 2026-08-16の障害再現: JSON.parseの失敗が本文にそのまま漏れていたパターン
    const leakedValue = "cd ~/kabu-ana-master && node -e garbage";
    getAdminAppMock.mockImplementation(() => {
      throw new FirebaseAdminConfigError(
        "FIREBASE_SERVICE_ACCOUNT_KEY の形式が不正です"
      );
    });

    const response = await getSubscriptionCheck({
      Authorization: "Bearer smoke-check-invalid-token",
    });

    expect(response.status).toBe(503);
    const bodyText = await response.text();
    expect(bodyText).not.toContain(leakedValue);
    expect(bodyText).not.toContain("FIREBASE_SERVICE_ACCOUNT_KEY");
    const body = JSON.parse(bodyText);
    expect(body.error).toBe("認証サービスが利用できません");
  });

  it("does not return store purchase identifiers (purchaseToken / orderId)", async () => {
    db = new FakeFirestore();
    db.seed("subscriptions/user-1", {
      userId: "user-1",
      status: "active",
      platform: "android",
      productId: "premium_monthly",
      purchaseToken: "secret-play-token",
      orderId: "GPA.1234",
      // 実物の Firestore は Timestamp（toDate を持つ）を返す
      expiryDate: { toDate: () => new Date("2099-01-01T00:00:00.000Z") },
      isTrial: false,
    });
    getAdminAppMock.mockReset();
    getAdminAppMock.mockReturnValue({});
    verifyIdTokenMock.mockResolvedValue({ uid: "user-1" });

    const response = await getSubscriptionCheck({
      Authorization: "Bearer valid-token",
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("secret-play-token");
    expect(text).not.toContain("GPA.1234");
    const body = JSON.parse(text);
    expect(body.isPremium).toBe(true);
    expect(body.subscription).not.toHaveProperty("purchaseToken");
    expect(body.subscription).not.toHaveProperty("orderId");
    expect(body.subscription.productId).toBe("premium_monthly");
  });

  it("keeps a cancelled Lemon Squeezy subscription premium until its end date", async () => {
    db = new FakeFirestore();
    db.seed("subscriptions/user-1", {
      userId: "user-1",
      status: "cancelled",
      platform: "web",
      productId: "123",
      expiryDate: {
        toDate: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      isTrial: false,
    });
    getAdminAppMock.mockReset();
    getAdminAppMock.mockReturnValue({});
    verifyIdTokenMock.mockResolvedValue({ uid: "user-1" });

    const response = await getSubscriptionCheck({
      Authorization: "Bearer valid-token",
    });

    expect(response.status).toBe(200);
    expect((await response.json()).isPremium).toBe(true);
  });
});
