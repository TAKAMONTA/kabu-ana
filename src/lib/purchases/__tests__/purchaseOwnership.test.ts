import { describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import {
  authUserExists,
  PURCHASE_OWNED_BY_OTHER_MESSAGE,
  PURCHASE_OWNERS_COLLECTION,
  PurchaseOwnedByOtherAccountError,
  purchaseOwnerKey,
  releasePurchaseOwnership,
  writeSubscriptionWithOwnership,
} from "../purchaseOwnership";
import type { VerifiedNativePurchase } from "../nativePurchaseVerification";
import { FakeFirestore, SERVER_TIMESTAMP } from "@/lib/__tests__/fakeFirestore";

function iosPurchase(
  overrides: Partial<VerifiedNativePurchase> = {}
): VerifiedNativePurchase {
  return {
    platform: "ios",
    productId: "com.takaapps.kabunavi.Monthly",
    purchaseToken: "2000000000000002",
    originalTransactionId: "1000000000000001",
    status: "active",
    expiryDate: "2099-01-01T00:00:00.000Z",
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
    purchaseToken: "play-token/with+odd=chars",
    originalTransactionId: "GPA.1234-5678-9012-34567..0",
    status: "active",
    isTrial: false,
    raw: {},
    ...overrides,
  };
}

const serverTimestamp = () => SERVER_TIMESTAMP;
/** 既定では所有者はまだ存在する（退会していない） */
const ownerExists = async () => true;

describe("purchaseOwnerKey", () => {
  it("uses the iOS originalTransactionId so renewals map to the same owner", () => {
    const first = purchaseOwnerKey(iosPurchase({ purchaseToken: "2000000000000002" }));
    const renewal = purchaseOwnerKey(
      iosPurchase({ purchaseToken: "2000000000000099" })
    );
    expect(renewal).toBe(first);
  });

  it("uses the Android purchaseToken (orderId changes on every renewal)", () => {
    const first = purchaseOwnerKey(androidPurchase());
    const renewal = purchaseOwnerKey(
      androidPurchase({ originalTransactionId: "GPA.1234-5678-9012-34567..1" })
    );
    expect(renewal).toBe(first);
    expect(
      purchaseOwnerKey(androidPurchase({ purchaseToken: "another-token" }))
    ).not.toBe(first);
  });

  it("produces a Firestore-safe document id (no slashes, no raw token)", () => {
    const key = purchaseOwnerKey(androidPurchase());
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain("play-token");
  });
});

describe("writeSubscriptionWithOwnership", () => {
  it("records the first account as owner and writes its subscription", async () => {
    const db = new FakeFirestore();
    const verified = iosPurchase();

    await writeSubscriptionWithOwnership(
      db as unknown as Firestore,
      "user-a",
      verified,
      exists => ({ status: "active", existed: exists }),
      serverTimestamp,
      ownerExists
    );

    const ownerPath = `${PURCHASE_OWNERS_COLLECTION}/${purchaseOwnerKey(verified)}`;
    expect(db.docs.get(ownerPath)).toMatchObject({
      uid: "user-a",
      platform: "ios",
    });
    expect(db.docs.get("subscriptions/user-a")).toEqual({
      status: "active",
      existed: false,
    });
  });

  it("lets the owner re-verify (renewals, restore) without conflict", async () => {
    const db = new FakeFirestore();
    const verified = iosPurchase();
    db.seed(`${PURCHASE_OWNERS_COLLECTION}/${purchaseOwnerKey(verified)}`, {
      uid: "user-a",
    });
    db.seed("subscriptions/user-a", { status: "expired", createdAt: "old" });

    await writeSubscriptionWithOwnership(
      db as unknown as Firestore,
      "user-a",
      verified,
      exists => ({ status: "active", existed: exists }),
      serverTimestamp,
      ownerExists
    );

    expect(db.docs.get("subscriptions/user-a")).toEqual({
      status: "active",
      existed: true,
      createdAt: "old",
    });
  });

  it("rejects another account and writes nothing", async () => {
    const db = new FakeFirestore();
    const verified = androidPurchase();
    db.seed(`${PURCHASE_OWNERS_COLLECTION}/${purchaseOwnerKey(verified)}`, {
      uid: "user-a",
    });

    const attempt = writeSubscriptionWithOwnership(
      db as unknown as Firestore,
      "user-b",
      verified,
      () => ({ status: "active" }),
      serverTimestamp,
      ownerExists
    );

    await expect(attempt).rejects.toBeInstanceOf(PurchaseOwnedByOtherAccountError);
    await expect(attempt).rejects.toMatchObject({
      statusCode: 409,
      message: PURCHASE_OWNED_BY_OTHER_MESSAGE,
    });
    expect(db.docs.has("subscriptions/user-b")).toBe(false);
  });
});

describe("writeSubscriptionWithOwnership when the owner account was deleted", () => {
  it("lets a new account take over a purchase whose owner no longer exists", async () => {
    // 退会時の解放漏れ・退会直後の古いトークンで所有記録が残った場合でも、
    // 同じ Apple ID で作り直したアカウントが 409 から抜け出せること
    const db = new FakeFirestore();
    const verified = iosPurchase();
    const ownerPath = `${PURCHASE_OWNERS_COLLECTION}/${purchaseOwnerKey(verified)}`;
    db.seed(ownerPath, { uid: "deleted-user", platform: "ios", createdAt: "old" });
    const checked: string[] = [];

    await writeSubscriptionWithOwnership(
      db as unknown as Firestore,
      "new-user",
      verified,
      () => ({ status: "active" }),
      serverTimestamp,
      async uid => {
        checked.push(uid);
        return false;
      }
    );

    expect(checked).toEqual(["deleted-user"]);
    expect(db.docs.get(ownerPath)).toMatchObject({
      uid: "new-user",
      createdAt: SERVER_TIMESTAMP,
    });
    expect(db.docs.get("subscriptions/new-user")).toEqual({ status: "active" });
  });

  it("does not take over when the owner's existence cannot be determined", async () => {
    const db = new FakeFirestore();
    const verified = iosPurchase();
    db.seed(`${PURCHASE_OWNERS_COLLECTION}/${purchaseOwnerKey(verified)}`, {
      uid: "user-a",
    });

    await expect(
      writeSubscriptionWithOwnership(
        db as unknown as Firestore,
        "user-b",
        verified,
        () => ({ status: "active" }),
        serverTimestamp,
        async () => {
          throw new Error("auth unavailable");
        }
      )
    ).rejects.toThrow("auth unavailable");
    expect(db.docs.has("subscriptions/user-b")).toBe(false);
  });
});

describe("authUserExists", () => {
  it("returns false only for auth/user-not-found", async () => {
    const missing = authUserExists({
      getUser: async () => {
        throw Object.assign(new Error("x"), { code: "auth/user-not-found" });
      },
    });
    await expect(missing("u")).resolves.toBe(false);
    await expect(authUserExists({ getUser: async () => ({}) })("u")).resolves.toBe(true);
    await expect(
      authUserExists({
        getUser: async () => {
          throw Object.assign(new Error("x"), { code: "auth/internal-error" });
        },
      })("u")
    ).rejects.toThrow();
  });
});

describe("writeSubscriptionWithOwnership under contention", () => {
  it("lets only one of two accounts claim the same purchase at the same time", async () => {
    const db = new FakeFirestore();
    const verified = iosPurchase();

    const results = await Promise.allSettled(
      ["user-a", "user-b"].map(uid =>
        writeSubscriptionWithOwnership(
          db as unknown as Firestore,
          uid,
          verified,
          () => ({ status: "active" }),
          serverTimestamp,
          ownerExists
        )
      )
    );

    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected"
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(PurchaseOwnedByOtherAccountError);
    const owner = db.docs.get(
      `${PURCHASE_OWNERS_COLLECTION}/${purchaseOwnerKey(verified)}`
    )?.uid;
    expect(db.docs.has(`subscriptions/${owner}`)).toBe(true);
    expect(
      ["user-a", "user-b"].filter(uid => db.docs.has(`subscriptions/${uid}`))
    ).toHaveLength(1);
  });
});

describe("releasePurchaseOwnership", () => {
  it("deletes only the owner records of the given account", async () => {
    const db = new FakeFirestore();
    db.seed(`${PURCHASE_OWNERS_COLLECTION}/a1`, { uid: "user-a" });
    db.seed(`${PURCHASE_OWNERS_COLLECTION}/a2`, { uid: "user-a" });
    db.seed(`${PURCHASE_OWNERS_COLLECTION}/b1`, { uid: "user-b" });

    const released = await releasePurchaseOwnership(
      db as unknown as Firestore,
      "user-a"
    );

    expect(released).toBe(2);
    expect([...db.docs.keys()]).toEqual([`${PURCHASE_OWNERS_COLLECTION}/b1`]);
  });
});
