import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getAdminAppMock = vi.fn();
const getFirestoreMock = vi.fn();
const getUserMock = vi.fn();
const verifyAppleNotificationMock = vi.fn();
const verifyNativePurchaseMock = vi.fn();

vi.mock("@/lib/firebase/admin", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/firebase/admin")>(
      "@/lib/firebase/admin"
    );
  return { ...actual, getAdminApp: () => getAdminAppMock() };
});

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ getUser: (uid: string) => getUserMock(uid) }),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => getFirestoreMock(),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

vi.mock("@/lib/purchases/appleNotifications", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/purchases/appleNotifications")
  >("@/lib/purchases/appleNotifications");
  return {
    ...actual,
    verifyAppleNotification: (...args: unknown[]) =>
      verifyAppleNotificationMock(...args),
  };
});

vi.mock("@/lib/purchases/nativePurchaseVerification", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/purchases/nativePurchaseVerification")
  >("@/lib/purchases/nativePurchaseVerification");
  return {
    ...actual,
    verifyNativePurchase: (...args: unknown[]) => verifyNativePurchaseMock(...args),
  };
});

import { POST } from "../route";
import {
  AppleNotificationConfigError,
  AppleNotificationVerificationError,
} from "@/lib/purchases/appleNotifications";
import {
  PurchaseVerificationError,
  type VerifiedNativePurchase,
} from "@/lib/purchases/nativePurchaseVerification";
import {
  PURCHASE_OWNERS_COLLECTION,
  purchaseOwnerKeyFor,
} from "@/lib/purchases/purchaseOwnership";
import {
  STORE_NOTIFICATIONS_COLLECTION,
  storeNotificationEventKey,
} from "@/lib/purchases/storeNotifications";
import { FakeFirestore } from "@/lib/__tests__/fakeFirestore";
import { isSubscriptionPremium } from "@/lib/types/subscription";

const ORIGINAL_TRANSACTION_ID = "1000000000000001";
const OWNER_PATH = `${PURCHASE_OWNERS_COLLECTION}/${purchaseOwnerKeyFor("ios", ORIGINAL_TRANSACTION_ID)}`;

function post(body: unknown = { signedPayload: "header.payload.signature" }) {
  return POST(
    new NextRequest("http://localhost/api/apple/notifications", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

function notification(overrides: {
  notificationType?: string;
  subtype?: string;
  notificationUUID?: string;
  signedDate?: number;
  productId?: string;
} = {}) {
  return {
    environment: "Production",
    notification: {
      notificationType: overrides.notificationType ?? "DID_RENEW",
      subtype: overrides.subtype,
      notificationUUID: overrides.notificationUUID ?? "uuid-1",
      signedDate: overrides.signedDate ?? 2_000,
      data: { signedTransactionInfo: "signed-transaction" },
    },
    transaction: {
      originalTransactionId: ORIGINAL_TRANSACTION_ID,
      transactionId: "2000000000000002",
      productId: overrides.productId ?? "com.takaapps.kabunavi.Monthly",
    },
  };
}

function verified(overrides: Partial<VerifiedNativePurchase> = {}): VerifiedNativePurchase {
  return {
    platform: "ios",
    productId: "com.takaapps.kabunavi.Monthly",
    purchaseToken: "2000000000000002",
    originalTransactionId: ORIGINAL_TRANSACTION_ID,
    status: "active",
    expiryDate: "2099-01-01T00:00:00.000Z",
    purchaseDate: "2026-01-01T00:00:00.000Z",
    isTrial: false,
    environment: "Production",
    raw: {},
    ...overrides,
  };
}

let db: FakeFirestore;

function seedOwner() {
  db.seed(OWNER_PATH, {
    uid: "user-1",
    platform: "ios",
    productId: "com.takaapps.kabunavi.Monthly",
  });
}

describe("POST /api/apple/notifications", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    db = new FakeFirestore();
    getAdminAppMock.mockReset().mockReturnValue({});
    getFirestoreMock.mockReset().mockReturnValue(db);
    getUserMock.mockReset().mockResolvedValue({ uid: "user-1" });
    verifyAppleNotificationMock.mockReset().mockResolvedValue(notification());
    verifyNativePurchaseMock.mockReset().mockResolvedValue(verified());
  });

  it("returns 400 when signedPayload is missing", async () => {
    const response = await post({});
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "通知の形式が不正です" });
    const invalidJson = await post("{");
    expect(invalidJson.status).toBe(400);
    expect(verifyAppleNotificationMock).not.toHaveBeenCalled();
  });

  it("returns 401 with a fixed message when the signature cannot be verified", async () => {
    verifyAppleNotificationMock.mockRejectedValue(
      new AppleNotificationVerificationError("通知の署名検証に失敗しました: status=3 secret-detail")
    );
    const response = await post();
    expect(response.status).toBe(401);
    const text = await response.text();
    expect(text).not.toContain("secret-detail");
    expect(JSON.parse(text)).toEqual({ error: "通知の署名を検証できませんでした" });
    expect(db.docs.size).toBe(0);
  });

  it("returns 503 without leaking the config detail when misconfigured", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    verifyAppleNotificationMock.mockRejectedValue(
      new AppleNotificationConfigError("APP_STORE_APP_APPLE_ID が設定されていません")
    );
    const response = await post();
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain("APP_STORE_APP_APPLE_ID");
    expect(JSON.parse(text)).toEqual({ error: "通知の受信設定が完了していません" });
    expect(consoleError).toHaveBeenCalled();
  });

  it("acknowledges notification types that do not change entitlement", async () => {
    verifyAppleNotificationMock.mockResolvedValue(
      notification({ notificationType: "DID_CHANGE_RENEWAL_STATUS", subtype: "AUTO_RENEW_DISABLED" })
    );
    const response = await post();
    expect(response.status).toBe(200);
    expect(verifyNativePurchaseMock).not.toHaveBeenCalled();
    expect(db.docs.size).toBe(0);
  });

  it("acknowledges products outside the allow list without calling the store", async () => {
    verifyAppleNotificationMock.mockResolvedValue(
      notification({ productId: "com.other.product" })
    );
    const response = await post();
    expect(response.status).toBe(200);
    expect(verifyNativePurchaseMock).not.toHaveBeenCalled();
  });

  it("records and acknowledges a purchase with no registered owner", async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(verifyNativePurchaseMock).not.toHaveBeenCalled();
    expect(db.docs.has("subscriptions/user-1")).toBe(false);
    const key = storeNotificationEventKey({
      platform: "ios",
      eventId: "uuid-1",
      type: "DID_RENEW",
      eventAt: 2_000,
    });
    expect(db.docs.get(`${STORE_NOTIFICATIONS_COLLECTION}/${key}`)?.outcome).toBe("no_owner");
  });

  it("re-verifies a renewal with the App Store and writes it for the owner", async () => {
    seedOwner();
    const response = await post();
    expect(response.status).toBe(200);
    expect(verifyNativePurchaseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "ios",
        productId: "com.takaapps.kabunavi.Monthly",
        purchaseToken: "2000000000000002",
      })
    );
    const subscription = db.docs.get("subscriptions/user-1")!;
    expect(subscription).toMatchObject({
      userId: "user-1",
      status: "active",
      platform: "ios",
      orderId: ORIGINAL_TRANSACTION_ID,
      lastStoreNotification: { type: "DID_RENEW", eventAt: 2_000 },
      createdAt: "SERVER_TIMESTAMP",
    });
    expect(isSubscriptionPremium(subscription)).toBe(true);
    expect(db.docs.get(OWNER_PATH)?.lastNotificationAt).toBe(2_000);
  });

  it("revokes premium on REFUND (store reports cancelled)", async () => {
    seedOwner();
    db.seed("subscriptions/user-1", {
      userId: "user-1",
      platform: "ios",
      orderId: ORIGINAL_TRANSACTION_ID,
      status: "active",
      expiryDate: new Date("2099-01-01T00:00:00.000Z"),
    });
    verifyAppleNotificationMock.mockResolvedValue(notification({ notificationType: "REFUND" }));
    verifyNativePurchaseMock.mockResolvedValue(verified({ status: "cancelled" }));

    expect((await post()).status).toBe(200);
    const subscription = db.docs.get("subscriptions/user-1")!;
    expect(subscription.status).toBe("cancelled");
    expect(isSubscriptionPremium(subscription)).toBe(false);
  });

  it("ignores a duplicate delivery of the same notificationUUID", async () => {
    seedOwner();
    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(200);
    expect(verifyNativePurchaseMock).toHaveBeenCalledTimes(1);
  });

  it("ignores a notification older than the last applied one", async () => {
    seedOwner();
    verifyAppleNotificationMock.mockResolvedValue(
      notification({ notificationUUID: "uuid-new", signedDate: 5_000 })
    );
    await post();

    verifyAppleNotificationMock.mockResolvedValue(
      notification({ notificationType: "EXPIRED", notificationUUID: "uuid-old", signedDate: 4_000 })
    );
    verifyNativePurchaseMock.mockResolvedValue(
      verified({ status: "expired", expiryDate: "2020-01-01T00:00:00.000Z" })
    );
    expect((await post()).status).toBe(200);
    expect(db.docs.get("subscriptions/user-1")?.status).toBe("active");
    expect(db.docs.get(OWNER_PATH)?.lastNotificationAt).toBe(5_000);
  });

  it("does not recreate data for an owner whose account was deleted", async () => {
    seedOwner();
    getUserMock.mockRejectedValue(
      Object.assign(new Error("no user"), { code: "auth/user-not-found" })
    );
    expect((await post()).status).toBe(200);
    expect(verifyNativePurchaseMock).not.toHaveBeenCalled();
    expect(db.docs.has("subscriptions/user-1")).toBe(false);
  });

  it("returns 5xx on a temporary store failure so Apple retries, without recording the event", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    seedOwner();
    verifyNativePurchaseMock.mockRejectedValue(
      new PurchaseVerificationError("ストアとの通信に失敗しました。時間をおいて再度お試しください。", 502)
    );
    const response = await post();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "購入状態を確認できませんでした" });
    expect(consoleError).toHaveBeenCalled();
    const recorded = [...db.docs.keys()].some(path =>
      path.startsWith(`${STORE_NOTIFICATIONS_COLLECTION}/`)
    );
    expect(recorded).toBe(false);

    // 再送では処理される
    verifyNativePurchaseMock.mockResolvedValue(verified());
    expect((await post()).status).toBe(200);
    expect(db.docs.get("subscriptions/user-1")?.status).toBe("active");
  });

  it("acknowledges a purchase the store cannot find (permanent error)", async () => {
    seedOwner();
    verifyNativePurchaseMock.mockRejectedValue(
      new PurchaseVerificationError("App Storeトランザクションが見つかりません", 404)
    );
    expect((await post()).status).toBe(200);
    expect(db.docs.has("subscriptions/user-1")).toBe(false);
  });

  it("returns 500 with a fixed message on unexpected errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    getFirestoreMock.mockImplementation(() => {
      throw new Error("internal detail: secret-xyz");
    });
    const response = await post();
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain("secret-xyz");
    expect(JSON.parse(text)).toEqual({ error: "通知を処理できませんでした" });
    expect(consoleError).toHaveBeenCalled();
  });
});
