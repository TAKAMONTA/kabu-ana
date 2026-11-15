import { describe, expect, it, vi } from "vitest";
import { optionalWithTimeout, withTimeout } from "../optionalTimeout";

describe("withTimeout", () => {
  it("resolves with the value when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve(1), 50, "x")).resolves.toBe(1);
  });

  it("rejects when the promise takes too long", async () => {
    await expect(
      withTimeout(new Promise(() => {}), 10, "slow")
    ).rejects.toThrow("timeout: slow");
  });

  it("propagates the original rejection", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("boom")), 50, "x")
    ).rejects.toThrow("boom");
  });
});

describe("optionalWithTimeout", () => {
  it("returns null on timeout instead of throwing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(optionalWithTimeout(new Promise(() => {}), 10, "slow")).resolves.toBeNull();
  });
});
