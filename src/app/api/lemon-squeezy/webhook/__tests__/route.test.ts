import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeFirestore, SERVER_TIMESTAMP } from "@/lib/__tests__/fakeFirestore";

const getAdminAppMock = vi.fn();
const getUserMock = vi.fn();
let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/firebase/admin")>(
      "@/lib/firebase/admin"
    );
  return { ...actual, getAdminApp: () => getAdminAppMock() };
});

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ getUser: getUserMock }),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => db,
  FieldValue: { serverTimestamp: () => SERVER_TIMESTAMP },
}));

import { POST } from "../route";
import { isSubscriptionPremium } from "@/lib/types/subscription";

const SECRET = "test-webhook-secret";
const ENV_KEYS = [
  "LEMON_SQUEEZY_WEBHOOK_SECRET",
  "LEMON_SQUEEZY_VARIANT_ID_MONTHLY",
  "LEMON_SQUEEZY_VARIANT_ID_YEARLY",
] as const;
const originalEnv = new Map(ENV_KEYS.map(key => [key, process.env[key]]));

function postWebhook(payload: unknown, secret = SECRET) {
  const raw = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return POST(
    new NextRequest("http://localhost/api/lemon-squeezy/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-signature": signature },
      body: raw,
    })
  );
}

/** docs.lemonsqueezy.com の example payload に沿った Subscription オブジェクト */
function subscriptionPayload(
  eventName: string,
  attributes: Record<string, unknown>
) {
  return {
    meta: { event_name: eventName, custom_data: { userId: "user-123" } },
    data: {
      type: "subscriptions",
      id: "3",
      attributes: {
        store_id: 2,
        customer_id: 2,
        order_id: 4,
        product_id: 2,
        variant_id: 11,
        status: "active",
        cancelled: false,
        trial_ends_at: null,
        renews_at: "2099-02-17T14:15:43.000000Z",
        ends_at: null,
        ...attributes,
      },
    },
  };
}

describe("POST /api/lemon-squeezy/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    db = new FakeFirestore();
    getAdminAppMock.mockReturnValue({});
    getUserMock.mockResolvedValue({ uid: "user-123" });
    process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
    process.env.LEMON_SQUEEZY_VARIANT_ID_MONTHLY = "11";
    process.env.LEMON_SQUEEZY_VARIANT_ID_YEARLY = "12";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of ENV_KEYS) {
      const value = originalEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("rejects an invalid signature", async () => {
    const response = await postWebhook(
      subscriptionPayload("subscription_created", {}),
      "wrong-secret"
    );
    expect(response.status).toBe(401);
    expect(db.docs.size).toBe(0);
  });

  it("stores subscription_created as an active web subscription", async () => {
    const response = await postWebhook(
      subscriptionPayload("subscription_created", {})
    );

    expect(response.status).toBe(200);
    const doc = db.docs.get("subscriptions/user-123");
    expect(doc).toMatchObject({
      userId: "user-123",
      status: "active",
      platform: "web",
      productId: "2",
      isTrial: false,
      createdAt: SERVER_TIMESTAMP,
      lemonSqueezyData: { subscriptionId: "3", variantId: 11, status: "active" },
    });
    expect(doc?.expiryDate).toEqual(new Date("2099-02-17T14:15:43.000000Z"));
  });

  it("acknowledges subscription_payment_success (an invoice object) without writing undefined", async () => {
    // invoice には renews_at / variant_id が無い。以前は undefined を set して毎回500
    const response = await postWebhook({
      meta: {
        event_name: "subscription_payment_success",
        custom_data: { userId: "user-123" },
      },
      data: {
        type: "subscription-invoices",
        id: "1",
        attributes: {
          subscription_id: 3,
          customer_id: 1,
          billing_reason: "renewal",
          status: "paid",
          total: 999,
        },
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(db.docs.size).toBe(0);
  });

  it("keeps premium after subscription_cancelled until ends_at (boolean cancelled, no cancelled_at)", async () => {
    db.seed("subscriptions/user-123", {
      userId: "user-123",
      status: "active",
      platform: "web",
      createdAt: "original",
    });
    const endsAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

    const response = await postWebhook(
      subscriptionPayload("subscription_cancelled", {
        status: "cancelled",
        cancelled: true,
        renews_at: endsAt,
        ends_at: endsAt,
      })
    );

    expect(response.status).toBe(200);
    const doc = db.docs.get("subscriptions/user-123")!;
    expect(doc.status).toBe("cancelled");
    expect(doc.expiryDate).toEqual(new Date(endsAt));
    expect(doc.createdAt).toBe("original");
    expect(doc.lemonSqueezyData).toMatchObject({
      status: "cancelled",
      cancelled: true,
      endsAt,
    });
    expect(doc.lemonSqueezyData).not.toHaveProperty("cancelledAt");
    // 自動更新を止めただけなので、支払い済みの期間中はプレミアムのまま
    expect(isSubscriptionPremium(doc)).toBe(true);
  });

  it("maps an expired subscription to expired (not premium)", async () => {
    await postWebhook(
      subscriptionPayload("subscription_updated", {
        status: "expired",
        cancelled: true,
        ends_at: "2026-01-01T00:00:00.000000Z",
      })
    );

    const doc = db.docs.get("subscriptions/user-123")!;
    expect(doc.status).toBe("expired");
    expect(isSubscriptionPremium(doc)).toBe(false);
  });

  it("ignores order_created for a subscription variant (does not reset expiry / trial)", async () => {
    db.seed("subscriptions/user-123", {
      status: "trial",
      platform: "web",
      isTrial: true,
      expiryDate: new Date("2099-01-01T00:00:00.000Z"),
    });

    const response = await postWebhook({
      meta: { event_name: "order_created", custom_data: { userId: "user-123" } },
      data: {
        type: "orders",
        id: "1",
        attributes: {
          customer_id: 1,
          status: "paid",
          first_order_item: { product_id: 2, variant_id: 11 },
        },
      },
    });

    expect(response.status).toBe(200);
    expect(db.docs.get("subscriptions/user-123")).toMatchObject({
      status: "trial",
      isTrial: true,
      expiryDate: new Date("2099-01-01T00:00:00.000Z"),
    });
  });

  it("ignores an unpaid order", async () => {
    await postWebhook({
      meta: { event_name: "order_created", custom_data: { userId: "user-123" } },
      data: {
        type: "orders",
        id: "1",
        attributes: {
          status: "pending",
          first_order_item: { product_id: 9, variant_id: 99 },
        },
      },
    });
    expect(db.docs.size).toBe(0);
  });

  it("stores a paid one-time order (non-subscription variant) without an expiry", async () => {
    await postWebhook({
      meta: { event_name: "order_created", custom_data: { userId: "user-123" } },
      data: {
        type: "orders",
        id: "7",
        attributes: {
          status: "paid",
          first_order_item: { product_id: 9, variant_id: 99 },
        },
      },
    });

    expect(db.docs.get("subscriptions/user-123")).toMatchObject({
      status: "active",
      platform: "web",
      productId: "9",
      expiryDate: null,
      lemonSqueezyData: { orderId: "7", status: "paid" },
    });
  });

  it("does not recreate data for a user that was deleted", async () => {
    getUserMock.mockRejectedValue(
      Object.assign(new Error("no user"), { code: "auth/user-not-found" })
    );

    const response = await postWebhook(
      subscriptionPayload("subscription_cancelled", {
        status: "cancelled",
        cancelled: true,
        ends_at: "2099-01-01T00:00:00.000000Z",
      })
    );

    expect(response.status).toBe(200);
    expect(db.docs.size).toBe(0);
  });

  it("returns a fixed 500 message (no internal detail) when Firestore fails", async () => {
    db.failOn("set", "subscriptions/", new Error("internal detail: secret-xyz"));

    const response = await postWebhook(
      subscriptionPayload("subscription_updated", {})
    );

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain("secret-xyz");
    expect(JSON.parse(text)).toEqual({ error: "Webhook processing failed" });
  });
});
