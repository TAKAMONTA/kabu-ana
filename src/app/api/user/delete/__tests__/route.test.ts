import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeFirestore } from "@/lib/__tests__/fakeFirestore";

const getAdminAppMock = vi.fn();
const verifyIdTokenMock = vi.fn();
const deleteUserMock = vi.fn();
const cancelSubscriptionMock = vi.fn();
let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/firebase/admin")>(
      "@/lib/firebase/admin"
    );
  return { ...actual, getAdminApp: () => getAdminAppMock() };
});

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    verifyIdToken: verifyIdTokenMock,
    deleteUser: deleteUserMock,
  }),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => db,
}));

vi.mock("@/lib/lemon-squeezy", async () => {
  const actual = await vi.importActual<typeof import("@/lib/lemon-squeezy")>(
    "@/lib/lemon-squeezy"
  );
  return {
    ...actual,
    cancelSubscription: (...args: unknown[]) => cancelSubscriptionMock(...args),
  };
});

import { POST } from "../route";
import { LemonSqueezyApiError } from "@/lib/lemon-squeezy";
import { PURCHASE_OWNERS_COLLECTION } from "@/lib/purchases/purchaseOwnership";

function postDelete(body: unknown = { idToken: "valid" }) {
  return POST(
    new NextRequest("http://localhost/api/user/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

function seedUserData() {
  db.seed("users/user-1", {});
  db.seed("users/user-1/watchlist/7203", { code: "7203" });
  db.seed(`${PURCHASE_OWNERS_COLLECTION}/key-1`, { uid: "user-1" });
  db.seed(`${PURCHASE_OWNERS_COLLECTION}/key-2`, { uid: "user-2" });
  db.seed("signals_claude_usage/user-1_2026-11-15", { userId: "user-1", count: 2 });
  db.seed("signals_claude_usage/user-2_2026-11-15", { userId: "user-2", count: 1 });
}

describe("POST /api/user/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    db = new FakeFirestore();
    getAdminAppMock.mockReturnValue({});
    verifyIdTokenMock.mockResolvedValue({ uid: "user-1" });
    deleteUserMock.mockResolvedValue(undefined);
    cancelSubscriptionMock.mockResolvedValue({});
  });

  it("cancels an active Lemon Squeezy subscription before deleting the account", async () => {
    seedUserData();
    db.seed("subscriptions/user-1", {
      platform: "web",
      status: "active",
      lemonSqueezyData: { subscriptionId: "3", status: "active" },
    });

    const response = await postDelete();

    expect(response.status).toBe(200);
    expect(cancelSubscriptionMock).toHaveBeenCalledWith("3");
    expect(deleteUserMock).toHaveBeenCalledWith("user-1");
    expect(db.docs.has("subscriptions/user-1")).toBe(false);
    expect(db.docs.has("users/user-1/watchlist/7203")).toBe(false);
    // 本人の所有記録・利用記録だけを消し、他人の分は残す
    expect(db.docs.has(`${PURCHASE_OWNERS_COLLECTION}/key-1`)).toBe(false);
    expect(db.docs.has(`${PURCHASE_OWNERS_COLLECTION}/key-2`)).toBe(true);
    expect(db.docs.has("signals_claude_usage/user-1_2026-11-15")).toBe(false);
    expect(db.docs.has("signals_claude_usage/user-2_2026-11-15")).toBe(true);
  });

  it("aborts with 502 and keeps everything when the cancellation fails", async () => {
    seedUserData();
    db.seed("subscriptions/user-1", {
      platform: "web",
      status: "active",
      lemonSqueezyData: { subscriptionId: "3", status: "active" },
    });
    cancelSubscriptionMock.mockRejectedValue(
      new LemonSqueezyApiError("Failed to cancel subscription: 500", "http", 500)
    );

    const response = await postDelete();

    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain("Failed to cancel");
    expect(JSON.parse(text).error).toContain("再度お試しください");
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(db.docs.has("subscriptions/user-1")).toBe(true);
    expect(db.docs.has("users/user-1/watchlist/7203")).toBe(true);
  });

  it("proceeds when Lemon Squeezy no longer has the subscription (404)", async () => {
    db.seed("subscriptions/user-1", {
      platform: "web",
      status: "active",
      lemonSqueezyData: { subscriptionId: "3", status: "active" },
    });
    cancelSubscriptionMock.mockRejectedValue(
      new LemonSqueezyApiError("Failed to cancel subscription: 404", "http", 404)
    );

    const response = await postDelete();

    expect(response.status).toBe(200);
    expect(deleteUserMock).toHaveBeenCalledWith("user-1");
  });

  it("does not call Lemon Squeezy for an already cancelled subscription", async () => {
    db.seed("subscriptions/user-1", {
      platform: "web",
      status: "cancelled",
      lemonSqueezyData: { subscriptionId: "3", status: "cancelled" },
    });

    const response = await postDelete();

    expect(response.status).toBe(200);
    expect(cancelSubscriptionMock).not.toHaveBeenCalled();
  });

  it("does not block deletion for native (App Store / Google Play) subscriptions", async () => {
    db.seed("subscriptions/user-1", {
      platform: "ios",
      status: "active",
      purchaseToken: "tx-1",
    });

    const response = await postDelete();

    expect(response.status).toBe(200);
    expect(cancelSubscriptionMock).not.toHaveBeenCalled();
    expect(deleteUserMock).toHaveBeenCalledWith("user-1");
    expect(db.docs.has("subscriptions/user-1")).toBe(false);
  });

  it("returns 400 when the idToken is missing", async () => {
    const response = await postDelete({});
    expect(response.status).toBe(400);
    expect(deleteUserMock).not.toHaveBeenCalled();
  });
});
