import { describe, expect, it, vi } from "vitest";
import {
  maybeRefreshNativeSubscription,
  NATIVE_REFRESH_THROTTLE_MS,
  shouldRefreshNativeSubscription,
  type NativeRefreshDeps,
} from "../nativeRefresh";

const NOW = Date.parse("2026-11-15T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("shouldRefreshNativeSubscription", () => {
  it("refreshes a native subscription that expires within 3 days or has expired (renewal)", () => {
    for (const offset of [2 * DAY, -DAY]) {
      expect(
        shouldRefreshNativeSubscription(
          { platform: "ios", expiryDate: new Date(NOW + offset), storeValidatedAt: new Date(NOW) },
          NOW,
          null
        )
      ).toBe(true);
    }
  });

  it("refreshes when the last store verification is older than 24h (refunds)", () => {
    expect(
      shouldRefreshNativeSubscription(
        {
          platform: "android",
          expiryDate: new Date(NOW + 20 * DAY),
          storeValidatedAt: new Date(NOW - 25 * 60 * 60 * 1000),
        },
        NOW,
        null
      )
    ).toBe(true);
    expect(
      shouldRefreshNativeSubscription(
        { platform: "android", expiryDate: new Date(NOW + 20 * DAY) },
        NOW,
        null
      )
    ).toBe(true);
  });

  it("does nothing for a fresh, far-from-expiry native subscription, or for web", () => {
    expect(
      shouldRefreshNativeSubscription(
        {
          platform: "ios",
          expiryDate: new Date(NOW + 20 * DAY),
          storeValidatedAt: new Date(NOW - 60 * 60 * 1000),
        },
        NOW,
        null
      )
    ).toBe(false);
    expect(
      shouldRefreshNativeSubscription(
        { platform: "web", expiryDate: new Date(NOW - DAY) },
        NOW,
        null
      )
    ).toBe(false);
  });

  it("throttles to once per 6 hours per device", () => {
    const sub = { platform: "ios", expiryDate: new Date(NOW - DAY) };
    expect(shouldRefreshNativeSubscription(sub, NOW, NOW - 60 * 1000)).toBe(false);
    expect(
      shouldRefreshNativeSubscription(sub, NOW, NOW - NATIVE_REFRESH_THROTTLE_MS - 1)
    ).toBe(true);
  });
});

describe("maybeRefreshNativeSubscription", () => {
  function deps(overrides: Partial<NativeRefreshDeps> = {}) {
    const store = new Map<string, string>();
    return {
      now: () => NOW,
      isNativeApp: async () => true,
      storage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
      requestRefresh: vi.fn(async () => {}),
      ...overrides,
    };
  }
  const expiring = { platform: "ios", expiryDate: new Date(NOW + DAY) };

  it("calls the refresh API once and then throttles", async () => {
    const d = deps();
    await expect(maybeRefreshNativeSubscription("u1", expiring, d)).resolves.toBe(true);
    await expect(maybeRefreshNativeSubscription("u1", expiring, d)).resolves.toBe(false);
    expect(d.requestRefresh).toHaveBeenCalledTimes(1);
  });

  it("stays silent when the request fails or storage is unavailable", async () => {
    const d = deps({
      requestRefresh: vi.fn(async () => {
        throw new Error("offline");
      }),
      storage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
      },
    });
    await expect(maybeRefreshNativeSubscription("u1", expiring, d)).resolves.toBe(true);
  });

  it("does nothing outside the native app", async () => {
    const d = deps({ isNativeApp: async () => false });
    await expect(maybeRefreshNativeSubscription("u1", expiring, d)).resolves.toBe(false);
    expect(d.requestRefresh).not.toHaveBeenCalled();
  });
});
