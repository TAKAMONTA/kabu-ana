import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeFirestore, SERVER_TIMESTAMP } from "@/lib/__tests__/fakeFirestore";

const getAdminAppMock = vi.fn();
const verifyIdTokenMock = vi.fn();
const verifyNativePurchaseMock = vi.fn();
let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/firebase/admin")>(
      "@/lib/firebase/admin"
    );
  return { ...actual, getAdminApp: () => getAdminAppMock() };
});

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: verifyIdTokenMock }),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => db,
  FieldValue: { serverTimestamp: () => SERVER_TIMESTAMP },
}));

vi.mock("@/lib/purchases/nativePurchaseVerification", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/purchases/nativePurchaseVerification")
  >("@/lib/purchases/nativePurchaseVerification");
  return {
    ...actual,
    verifyNativePurchase: (...args: unknown[]) =>
      verifyNativePurchaseMock(...args),
  };
});

import { POST } from "../route";
import { FirebaseAdminConfigError } from "@/lib/firebase/admin";
import {
  PURCHASE_OWNED_BY_OTHER_MESSAGE,
  PURCHASE_OWNERS_COLLECTION,
  purchaseOwnerKey,
} from "@/lib/purchases/purchaseOwnership";
import type { VerifiedNativePurchase } from "@/lib/purchases/nativePurchaseVerification";

const VERIFIED: VerifiedNativePurchase = {
  platform: "ios",
  productId: "com.takaapps.kabunavi.Monthly",
  purchaseToken: "2000000000000002",
  originalTransactionId: "1000000000000001",
  status: "active",
  expiryDate: "2099-01-01T00:00:00.000Z",
  isTrial: false,
  environment: "Production",
  raw: {},
};

function postUpdate(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/subscription/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

const VALID_BODY = {
  idToken: "token-of-b",
  platform: "ios",
  productId: "com.takaapps.kabunavi.Monthly",
  purchaseToken: "2000000000000002",
};

describe("POST /api/subscription/update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    db = new FakeFirestore();
    getAdminAppMock.mockReturnValue({});
    verifyIdTokenMock.mockResolvedValue({ uid: "user-b" });
    verifyNativePurchaseMock.mockResolvedValue(VERIFIED);
  });

  it("binds a verified purchase to the first account that registers it", async () => {
    const response = await postUpdate(VALID_BODY);

    expect(response.status).toBe(200);
    const owner = db.docs.get(
      `${PURCHASE_OWNERS_COLLECTION}/${purchaseOwnerKey(VERIFIED)}`
    );
    expect(owner).toMatchObject({ uid: "user-b" });
    expect(db.docs.get("subscriptions/user-b")).toMatchObject({
      userId: "user-b",
      status: "active",
      createdAt: SERVER_TIMESTAMP,
    });
  });

  it("rejects with 409 when another account already owns the purchase", async () => {
    // 他人の purchaseToken を送って premium になる経路を塞ぐ
    db.seed(`${PURCHASE_OWNERS_COLLECTION}/${purchaseOwnerKey(VERIFIED)}`, {
      uid: "user-a",
    });

    const response = await postUpdate(VALID_BODY);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: PURCHASE_OWNED_BY_OTHER_MESSAGE,
    });
    expect(db.docs.has("subscriptions/user-b")).toBe(false);
  });

  it("returns 400 for a non-JSON body instead of a 500", async () => {
    const response = await postUpdate("{not json");

    expect(response.status).toBe(400);
    expect(verifyNativePurchaseMock).not.toHaveBeenCalled();
  });

  it("returns 503 without leaking details when Firebase Admin SDK is misconfigured", async () => {
    getAdminAppMock.mockImplementation(() => {
      throw new FirebaseAdminConfigError(
        "FIREBASE_SERVICE_ACCOUNT_KEY が設定されていません"
      );
    });

    const response = await postUpdate(VALID_BODY);

    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain("FIREBASE_SERVICE_ACCOUNT_KEY");
    expect(JSON.parse(text)).toEqual({ error: "認証サービスが利用できません" });
  });
});
