import { describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import {
  applyStoreNotification,
  findPurchaseOwner,
  isStoreNotificationProcessed,
  recordStoreNotification,
  shouldApplyStoreNotification,
  STORE_NOTIFICATIONS_COLLECTION,
  storeNotificationEventKey,
  type StoreNotificationEvent,
} from "../storeNotifications";
import {
  PURCHASE_OWNERS_COLLECTION,
  purchaseOwnerKey,
  purchaseOwnerKeyFor,
} from "../purchaseOwnership";
import type { VerifiedNativePurchase } from "../nativePurchaseVerification";
import { FakeFirestore, SERVER_TIMESTAMP } from "@/lib/__tests__/fakeFirestore";

const NOW = new Date("2026-11-16T00:00:00.000Z");

function iosPurchase(
  overrides: Partial<VerifiedNativePurchase> = {}
): VerifiedNativePurchase {
  return {
    platform: "ios",
    productId: "com.takaapps.kabunavi.Monthly",
    purchaseToken: "2000000000000002",
    originalTransactionId: "1000000000000001",
    status: "active",
    expiryDate: "2026-12-16T00:00:00.000Z",
    isTrial: false,
    raw: {},
    ...overrides,
  };
}

function androidPurchase(
  overrides: Partial<VerifiedNativePurchase> = {}
): VerifiedNativePurchase {
  return {
    platform: "android",
    productId: "premium_monthly",
    purchaseToken: "android-token-new",
    originalTransactionId: "GPA.1234-5678",
    status: "active",
    expiryDate: "2026-12-16T00:00:00.000Z",
    isTrial: false,
    raw: {},
    ...overrides,
  };
}

function event(overrides: Partial<StoreNotificationEvent> = {}): StoreNotificationEvent {
  return {
    platform: "ios",
    eventId: "uuid-1",
    type: "DID_RENEW",
    eventAt: 1_000,
    ...overrides,
  };
}

const serverTimestamp = () => SERVER_TIMESTAMP;

function seedOwner(
  db: FakeFirestore,
  verified: VerifiedNativePurchase,
  data: Record<string, unknown> = {}
) {
  db.seed(`${PURCHASE_OWNERS_COLLECTION}/${purchaseOwnerKey(verified)}`, {
    uid: "user-1",
    platform: verified.platform,
    productId: verified.productId,
    ...data,
  });
}

function apply(
  db: FakeFirestore,
  verified: VerifiedNativePurchase,
  overrides: Partial<Parameters<typeof applyStoreNotification>[1]> = {}
) {
  return applyStoreNotification(db as unknown as Firestore, {
    uid: "user-1",
    ownerKey: purchaseOwnerKey(verified),
    event: event(),
    verified,
    buildSubscriptionData: exists => ({
      userId: "user-1",
      status: verified.status,
      platform: verified.platform,
      productId: verified.productId,
      purchaseToken: verified.purchaseToken,
      orderId: verified.originalTransactionId ?? null,
      expiryDate: verified.expiryDate ? new Date(verified.expiryDate) : null,
      ...(exists ? {} : { createdAt: SERVER_TIMESTAMP }),
    }),
    serverTimestamp,
    now: NOW,
    ...overrides,
  });
}

describe("purchaseOwnerKeyFor", () => {
  it("matches purchaseOwnerKey for the stable id of each platform", () => {
    expect(purchaseOwnerKeyFor("ios", "1000000000000001")).toBe(
      purchaseOwnerKey(iosPurchase())
    );
    expect(purchaseOwnerKeyFor("android", "android-token-new")).toBe(
      purchaseOwnerKey(androidPurchase())
    );
  });
});

describe("findPurchaseOwner", () => {
  it("returns the owner uid and product, or null when not registered", async () => {
    const db = new FakeFirestore();
    seedOwner(db, iosPurchase());
    await expect(
      findPurchaseOwner(db as unknown as Firestore, "ios", "1000000000000001")
    ).resolves.toEqual({
      key: purchaseOwnerKey(iosPurchase()),
      uid: "user-1",
      productId: "com.takaapps.kabunavi.Monthly",
    });
    await expect(
      findPurchaseOwner(db as unknown as Firestore, "ios", "999")
    ).resolves.toBeNull();
  });
});

describe("shouldApplyStoreNotification", () => {
  it("applies when there is no subscription yet", () => {
    expect(shouldApplyStoreNotification(undefined, iosPurchase(), undefined, NOW)).toBe(true);
  });

  it("applies any state for the same purchase lineage (including refunds)", () => {
    const current = {
      platform: "ios",
      orderId: "1000000000000001",
      status: "active",
      expiryDate: new Date("2026-12-01T00:00:00.000Z"),
    };
    expect(
      shouldApplyStoreNotification(
        current,
        iosPurchase({ status: "cancelled" }),
        undefined,
        NOW
      )
    ).toBe(true);
  });

  it("does not overwrite an active Web subscription with an expired native purchase", () => {
    const current = {
      platform: "web",
      status: "active",
      expiryDate: new Date("2026-12-01T00:00:00.000Z"),
    };
    expect(
      shouldApplyStoreNotification(
        current,
        iosPurchase({ status: "expired", expiryDate: "2026-11-01T00:00:00.000Z" }),
        undefined,
        NOW
      )
    ).toBe(false);
  });

  it("replaces an inactive subscription of another purchase with an active one", () => {
    const current = {
      platform: "web",
      status: "expired",
      expiryDate: new Date("2026-10-01T00:00:00.000Z"),
    };
    expect(shouldApplyStoreNotification(current, iosPurchase(), undefined, NOW)).toBe(true);
  });

  it("treats an Android token linked to the stored token as the same lineage", () => {
    const current = {
      platform: "android",
      purchaseToken: "android-token-old",
      status: "active",
      expiryDate: new Date("2026-12-01T00:00:00.000Z"),
    };
    expect(
      shouldApplyStoreNotification(
        current,
        androidPurchase({ status: "expired", expiryDate: "2026-11-01T00:00:00.000Z" }),
        "android-token-old",
        NOW
      )
    ).toBe(true);
  });
});

describe("applyStoreNotification", () => {
  it("writes the subscription, the owner's lastNotificationAt and the event record", async () => {
    const db = new FakeFirestore();
    const verified = iosPurchase();
    seedOwner(db, verified);

    await expect(apply(db, verified)).resolves.toBe("applied");

    expect(db.docs.get("subscriptions/user-1")).toMatchObject({
      status: "active",
      platform: "ios",
      orderId: "1000000000000001",
      createdAt: SERVER_TIMESTAMP,
    });
    expect(
      db.docs.get(`${PURCHASE_OWNERS_COLLECTION}/${purchaseOwnerKey(verified)}`)
    ).toMatchObject({ uid: "user-1", lastNotificationAt: 1_000 });
    const record = db.docs.get(
      `${STORE_NOTIFICATIONS_COLLECTION}/${storeNotificationEventKey(event())}`
    );
    expect(record).toMatchObject({ platform: "ios", type: "DID_RENEW", outcome: "applied" });
    // 重複排除の記録に uid は残さない
    expect(JSON.stringify(record)).not.toContain("user-1");
  });

  it("ignores a duplicate notification (same event id)", async () => {
    const db = new FakeFirestore();
    const verified = iosPurchase();
    seedOwner(db, verified);
    await apply(db, verified);

    await expect(
      apply(db, iosPurchase({ status: "cancelled" }))
    ).resolves.toBe("duplicate");
    expect(db.docs.get("subscriptions/user-1")?.status).toBe("active");
  });

  it("ignores a notification older than the last applied one", async () => {
    const db = new FakeFirestore();
    const verified = iosPurchase({ status: "expired" });
    seedOwner(db, verified, { lastNotificationAt: 5_000 });
    db.seed("subscriptions/user-1", {
      platform: "ios",
      orderId: "1000000000000001",
      status: "active",
    });

    await expect(
      apply(db, verified, { event: event({ eventId: "uuid-old", eventAt: 4_999 }) })
    ).resolves.toBe("stale");
    expect(db.docs.get("subscriptions/user-1")?.status).toBe("active");
    // 古い通知も処理済みとして記録する（再送で同じ判定を繰り返さない）
    await expect(
      isStoreNotificationProcessed(
        db as unknown as Firestore,
        event({ eventId: "uuid-old", eventAt: 4_999 })
      )
    ).resolves.toBe(true);
  });

  it("does not write when the owner changed before the transaction", async () => {
    const db = new FakeFirestore();
    const verified = iosPurchase();
    seedOwner(db, verified, { uid: "user-2" });

    await expect(apply(db, verified)).resolves.toBe("owner_changed");
    expect(db.docs.has("subscriptions/user-1")).toBe(false);
  });

  it("does not overwrite an active subscription of another purchase", async () => {
    const db = new FakeFirestore();
    const verified = iosPurchase({ status: "expired", expiryDate: "2026-11-01T00:00:00.000Z" });
    seedOwner(db, verified);
    db.seed("subscriptions/user-1", {
      platform: "web",
      status: "active",
      expiryDate: new Date("2026-12-01T00:00:00.000Z"),
    });

    await expect(apply(db, verified)).resolves.toBe("other_purchase");
    expect(db.docs.get("subscriptions/user-1")?.platform).toBe("web");
  });

  it("creates the owner record for a new Android token when allowed", async () => {
    const db = new FakeFirestore();
    const verified = androidPurchase();
    db.seed("subscriptions/user-1", {
      platform: "android",
      purchaseToken: "android-token-old",
      status: "active",
    });

    await expect(
      apply(db, verified, {
        createOwnerIfMissing: true,
        linkedPurchaseToken: "android-token-old",
        event: event({ platform: "android", eventId: "msg-1" }),
      })
    ).resolves.toBe("applied");
    expect(
      db.docs.get(`${PURCHASE_OWNERS_COLLECTION}/${purchaseOwnerKey(verified)}`)
    ).toMatchObject({ uid: "user-1", platform: "android", productId: "premium_monthly" });
    expect(db.docs.get("subscriptions/user-1")?.purchaseToken).toBe("android-token-new");
  });

  it("records skipped notifications outside a transaction", async () => {
    const db = new FakeFirestore();
    await recordStoreNotification(
      db as unknown as Firestore,
      event({ eventId: "uuid-skip" }),
      "no_owner",
      serverTimestamp,
      NOW
    );
    await expect(
      isStoreNotificationProcessed(db as unknown as Firestore, event({ eventId: "uuid-skip" }))
    ).resolves.toBe(true);
  });
});
