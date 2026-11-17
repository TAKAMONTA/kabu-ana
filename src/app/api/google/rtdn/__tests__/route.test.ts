import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getAdminAppMock = vi.fn();
const getFirestoreMock = vi.fn();
const getUserMock = vi.fn();
const verifyPubSubPushTokenMock = vi.fn();
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

vi.mock("@/lib/purchases/googleRtdn", async () => {
  const actual = await vi.importActual<typeof import("@/lib/purchases/googleRtdn")>(
    "@/lib/purchases/googleRtdn"
  );
  return {
    ...actual,
    verifyPubSubPushToken: (...args: unknown[]) => verifyPubSubPushTokenMock(...args),
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
import { RtdnAuthError } from "@/lib/purchases/googleRtdn";
import {
  PurchaseVerificationError,
  type VerifiedNativePurchase,
} from "@/lib/purchases/nativePurchaseVerification";
import {
  PURCHASE_OWNERS_COLLECTION,
  purchaseOwnerKeyFor,
} from "@/lib/purchases/purchaseOwnership";
import { FakeFirestore } from "@/lib/__tests__/fakeFirestore";
import { isSubscriptionPremium } from "@/lib/types/subscription";

const PACKAGE_NAME = "app.vercel.kabu_9t7mdgybz_takamontas_projects.twa";
const TOKEN = "purchase-token-1";
const ownerPath = (token: string) =>
  `${PURCHASE_OWNERS_COLLECTION}/${purchaseOwnerKeyFor("android", token)}`;

function developerNotification(overrides: Record<string, unknown> = {}) {
  return {
    version: "1.0",
    packageName: PACKAGE_NAME,
    eventTimeMillis: "2000",
    subscriptionNotification: {
      version: "1.0",
      notificationType: 2,
      purchaseToken: TOKEN,
      subscriptionId: "premium_monthly",
    },
    ...overrides,
  };
}

function post(
  notification: unknown = developerNotification(),
  messageId = "msg-1",
  rawBody?: string
) {
  const body =
    rawBody ??
    JSON.stringify({
      message: {
        data: Buffer.from(JSON.stringify(notification)).toString("base64"),
        messageId,
        publishTime: "2026-11-16T00:00:00.000Z",
      },
      subscription: "projects/p/subscriptions/rtdn-push",
    });
  return POST(
    new NextRequest("http://localhost/api/google/rtdn", {
      method: "POST",
      headers: { Authorization: "Bearer oidc-token" },
      body,
    })
  );
}

function verified(overrides: Partial<VerifiedNativePurchase> = {}): VerifiedNativePurchase {
  return {
    platform: "android",
    productId: "premium_monthly",
    purchaseToken: TOKEN,
    originalTransactionId: "GPA.1234-5678-9012-34567",
    status: "active",
    expiryDate: "2099-01-01T00:00:00.000Z",
    purchaseDate: "2026-01-01T00:00:00.000Z",
    isTrial: false,
    environment: "GooglePlay",
    raw: {},
    ...overrides,
  };
}

let db: FakeFirestore;

function seedOwner(token = TOKEN, uid = "user-1") {
  db.seed(ownerPath(token), { uid, platform: "android", productId: "premium_monthly" });
}

describe("POST /api/google/rtdn", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("GOOGLE_RTDN_PUSH_AUDIENCE", "https://example.test/api/google/rtdn");
    vi.stubEnv(
      "GOOGLE_RTDN_PUSH_SERVICE_ACCOUNT_EMAIL",
      "rtdn-push@project.iam.gserviceaccount.com"
    );
    vi.stubEnv("GOOGLE_PLAY_PACKAGE_NAME", PACKAGE_NAME);
    db = new FakeFirestore();
    getAdminAppMock.mockReset().mockReturnValue({});
    getFirestoreMock.mockReset().mockReturnValue(db);
    getUserMock.mockReset().mockResolvedValue({ uid: "user-1" });
    verifyPubSubPushTokenMock.mockReset().mockResolvedValue(undefined);
    verifyNativePurchaseMock.mockReset().mockResolvedValue(verified());
  });

  it("returns 401 with a fixed message when the OIDC token is rejected", async () => {
    verifyPubSubPushTokenMock.mockRejectedValue(
      new RtdnAuthError("OIDC トークンのサービスアカウントが一致しません attacker@example.com")
    );
    const response = await post();
    expect(response.status).toBe(401);
    const text = await response.text();
    expect(text).not.toContain("attacker");
    expect(JSON.parse(text)).toEqual({ error: "通知の認証に失敗しました" });
    expect(db.docs.size).toBe(0);
  });

  it("returns 503 without leaking the env name when the push auth is not configured", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("GOOGLE_RTDN_PUSH_AUDIENCE", "");
    const response = await post();
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain("GOOGLE_RTDN");
    expect(JSON.parse(text)).toEqual({ error: "通知の受信設定が完了していません" });
    expect(verifyPubSubPushTokenMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it("acknowledges malformed messages (redelivery would not fix them)", async () => {
    const response = await post(undefined, "msg-1", JSON.stringify({ message: { data: "!!" } }));
    expect(response.status).toBe(200);
    expect(verifyNativePurchaseMock).not.toHaveBeenCalled();
  });

  it("acknowledges notifications for another package and test notifications", async () => {
    seedOwner();
    expect((await post(developerNotification({ packageName: "com.other" }))).status).toBe(200);
    expect(
      (
        await post({
          version: "1.0",
          packageName: PACKAGE_NAME,
          eventTimeMillis: "2000",
          testNotification: { version: "1.0" },
        })
      ).status
    ).toBe(200);
    expect(verifyNativePurchaseMock).not.toHaveBeenCalled();
  });

  it("acknowledges subscription notification types that do not change entitlement", async () => {
    seedOwner();
    const response = await post(
      developerNotification({
        subscriptionNotification: { version: "1.0", notificationType: 19, purchaseToken: TOKEN },
      })
    );
    expect(response.status).toBe(200);
    expect(verifyNativePurchaseMock).not.toHaveBeenCalled();
  });

  it("re-verifies a renewal with Google Play and writes it for the owner", async () => {
    seedOwner();
    expect((await post()).status).toBe(200);
    expect(verifyNativePurchaseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "android",
        productId: "premium_monthly",
        purchaseToken: TOKEN,
      })
    );
    const subscription = db.docs.get("subscriptions/user-1")!;
    expect(subscription).toMatchObject({
      status: "active",
      platform: "android",
      purchaseToken: TOKEN,
      lastStoreNotification: { type: "SUBSCRIPTION_RENEWED", eventAt: 2000 },
    });
    expect(isSubscriptionPremium(subscription)).toBe(true);
  });

  it("uses the stored product when the notification omits subscriptionId", async () => {
    seedOwner();
    await post(
      developerNotification({
        subscriptionNotification: { version: "1.0", notificationType: 13, purchaseToken: TOKEN },
      })
    );
    expect(verifyNativePurchaseMock).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "premium_monthly" })
    );
  });

  it("revokes premium on SUBSCRIPTION_REVOKED", async () => {
    seedOwner();
    db.seed("subscriptions/user-1", {
      platform: "android",
      purchaseToken: TOKEN,
      status: "active",
      expiryDate: new Date("2099-01-01T00:00:00.000Z"),
    });
    verifyNativePurchaseMock.mockResolvedValue(
      verified({ status: "expired", expiryDate: "2026-11-01T00:00:00.000Z" })
    );
    await post(
      developerNotification({
        subscriptionNotification: { version: "1.0", notificationType: 12, purchaseToken: TOKEN },
      })
    );
    expect(isSubscriptionPremium(db.docs.get("subscriptions/user-1"))).toBe(false);
  });

  it("re-verifies a voided subscription purchase (refund)", async () => {
    seedOwner();
    verifyNativePurchaseMock.mockResolvedValue(
      verified({ status: "expired", expiryDate: "2026-11-01T00:00:00.000Z" })
    );
    await post({
      version: "1.0",
      packageName: PACKAGE_NAME,
      eventTimeMillis: "3000",
      voidedPurchaseNotification: { purchaseToken: TOKEN, orderId: "GPA.1", productType: 1, refundType: 1 },
    });
    expect(verifyNativePurchaseMock).toHaveBeenCalledTimes(1);
    expect(db.docs.get("subscriptions/user-1")?.lastStoreNotification).toEqual({
      type: "VOIDED_PURCHASE",
      eventAt: 3000,
    });
  });

  it("ignores a duplicate delivery of the same Pub/Sub messageId", async () => {
    seedOwner();
    await post();
    await post();
    expect(verifyNativePurchaseMock).toHaveBeenCalledTimes(1);
  });

  it("ignores an event older than the last applied one", async () => {
    seedOwner();
    await post(developerNotification({ eventTimeMillis: "5000" }), "msg-new");
    verifyNativePurchaseMock.mockResolvedValue(
      verified({ status: "expired", expiryDate: "2020-01-01T00:00:00.000Z" })
    );
    await post(
      developerNotification({
        eventTimeMillis: "4000",
        subscriptionNotification: { version: "1.0", notificationType: 13, purchaseToken: TOKEN },
      }),
      "msg-old"
    );
    expect(db.docs.get("subscriptions/user-1")?.status).toBe("active");
  });

  it("does not call the store for an unregistered token (non-purchase event)", async () => {
    expect((await post()).status).toBe(200);
    expect(verifyNativePurchaseMock).not.toHaveBeenCalled();
    expect(db.docs.has("subscriptions/user-1")).toBe(false);
  });

  it("maps a new token to the owner of its linkedPurchaseToken (upgrade)", async () => {
    seedOwner("old-token");
    db.seed("subscriptions/user-1", {
      platform: "android",
      purchaseToken: "old-token",
      status: "active",
      expiryDate: new Date("2099-01-01T00:00:00.000Z"),
    });
    verifyNativePurchaseMock.mockResolvedValue(
      verified({ productId: "premium_yearly", raw: { linkedPurchaseToken: "old-token" } })
    );
    const response = await post(
      developerNotification({
        subscriptionNotification: {
          version: "1.0",
          notificationType: 4,
          purchaseToken: TOKEN,
          subscriptionId: "premium_yearly",
        },
      })
    );
    expect(response.status).toBe(200);
    expect(db.docs.get("subscriptions/user-1")).toMatchObject({
      purchaseToken: TOKEN,
      productId: "premium_yearly",
    });
    expect(db.docs.get(ownerPath(TOKEN))).toMatchObject({ uid: "user-1" });
  });

  it("returns 5xx on a temporary store failure so Pub/Sub redelivers", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    seedOwner();
    verifyNativePurchaseMock.mockRejectedValue(
      new PurchaseVerificationError("購入検証サービスが現在利用できません。時間をおいて再度お試しください。", 503)
    );
    const response = await post();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "購入状態を確認できませんでした" });
  });
});
