import { describe, expect, it } from "vitest";
import { isSubscriptionPremium, WEB_RENEWAL_GRACE_MS } from "../subscription";

const NOW = new Date("2026-11-15T00:00:00.000Z");
const FUTURE = new Date("2026-12-01T00:00:00.000Z");
const PAST = new Date("2026-11-01T00:00:00.000Z");

/** Firestore Timestamp の代わり（toDate を持つオブジェクト） */
const timestamp = (date: Date) => ({ toDate: () => date });

describe("isSubscriptionPremium", () => {
  it("returns false for a missing subscription", () => {
    expect(isSubscriptionPremium(null, NOW)).toBe(false);
    expect(isSubscriptionPremium(undefined, NOW)).toBe(false);
  });

  it("treats active / trial as premium until the expiry date", () => {
    expect(
      isSubscriptionPremium({ status: "active", expiryDate: FUTURE }, NOW)
    ).toBe(true);
    expect(
      isSubscriptionPremium({ status: "trial", expiryDate: FUTURE }, NOW)
    ).toBe(true);
    expect(
      isSubscriptionPremium({ status: "active", expiryDate: PAST }, NOW)
    ).toBe(false);
  });

  it("treats active without an expiry date as premium (one-time purchase)", () => {
    expect(isSubscriptionPremium({ status: "active" }, NOW)).toBe(true);
    expect(
      isSubscriptionPremium({ status: "active", expiryDate: null }, NOW)
    ).toBe(true);
  });

  it("accepts Firestore Timestamps and ISO strings as the expiry date", () => {
    expect(
      isSubscriptionPremium(
        { status: "active", expiryDate: timestamp(FUTURE) },
        NOW
      )
    ).toBe(true);
    expect(
      isSubscriptionPremium(
        { status: "active", expiryDate: timestamp(PAST) },
        NOW
      )
    ).toBe(false);
    expect(
      isSubscriptionPremium(
        { status: "active", expiryDate: FUTURE.toISOString() },
        NOW
      )
    ).toBe(true);
  });

  it("keeps a cancelled Lemon Squeezy (web) subscription premium until ends_at", () => {
    // Lemon Squeezy の cancelled は自動更新の停止。支払い済み期間中は使える
    expect(
      isSubscriptionPremium(
        { status: "cancelled", platform: "web", expiryDate: timestamp(FUTURE) },
        NOW
      )
    ).toBe(true);
    expect(
      isSubscriptionPremium(
        { status: "cancelled", platform: "web", expiryDate: timestamp(PAST) },
        NOW
      )
    ).toBe(false);
  });

  it("does not grant premium to a cancelled web subscription without an expiry", () => {
    expect(
      isSubscriptionPremium({ status: "cancelled", platform: "web" }, NOW)
    ).toBe(false);
  });

  it("treats legacy cancelled docs without a platform like web", () => {
    expect(
      isSubscriptionPremium({ status: "cancelled", expiryDate: FUTURE }, NOW)
    ).toBe(true);
  });

  it("never grants premium to a revoked (cancelled) native purchase", () => {
    // ネイティブの cancelled は返金・取り消し。期限が未来でも無効
    for (const platform of ["ios", "android"]) {
      expect(
        isSubscriptionPremium(
          { status: "cancelled", platform, expiryDate: FUTURE },
          NOW
        )
      ).toBe(false);
    }
  });

  it("rejects expired / pending / unknown statuses", () => {
    for (const status of ["expired", "pending", "unknown", undefined]) {
      expect(
        isSubscriptionPremium({ status, expiryDate: FUTURE }, NOW)
      ).toBe(false);
    }
  });

  it("fails closed when the expiry date cannot be interpreted", () => {
    expect(
      isSubscriptionPremium({ status: "active", expiryDate: "not-a-date" }, NOW)
    ).toBe(false);
    expect(
      isSubscriptionPremium({ status: "active", expiryDate: { foo: 1 } }, NOW)
    ).toBe(false);
  });

  it("gives active/trial web subscriptions a 48h grace after renews_at (renewal webhook may lag)", () => {
    const justRenewed = new Date(NOW.getTime() - 60 * 60 * 1000); // 1時間前が更新日
    expect(
      isSubscriptionPremium({ status: "active", platform: "web", expiryDate: justRenewed }, NOW)
    ).toBe(true);
    expect(
      isSubscriptionPremium({ status: "trial", platform: "web", expiryDate: justRenewed }, NOW)
    ).toBe(true);
    const beyondGrace = new Date(NOW.getTime() - WEB_RENEWAL_GRACE_MS - 1);
    expect(
      isSubscriptionPremium({ status: "active", platform: "web", expiryDate: beyondGrace }, NOW)
    ).toBe(false);
  });

  it("does not add the grace to native subscriptions or to cancelled web subscriptions", () => {
    const justPassed = new Date(NOW.getTime() - 60 * 60 * 1000);
    for (const platform of ["ios", "android"]) {
      expect(
        isSubscriptionPremium({ status: "active", platform, expiryDate: justPassed }, NOW)
      ).toBe(false);
    }
    expect(
      isSubscriptionPremium({ status: "cancelled", platform: "web", expiryDate: justPassed }, NOW)
    ).toBe(false);
  });
});
