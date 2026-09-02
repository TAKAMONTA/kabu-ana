import { describe, it, expect } from "vitest";
import { FREE_WATCHLIST_LIMIT, watchlistLimit, canAddMore } from "../limits";

describe("watchlist limits", () => {
  it("無料プランの上限は3件", () => {
    expect(FREE_WATCHLIST_LIMIT).toBe(3);
    expect(watchlistLimit(false)).toBe(3);
  });

  it("プレミアムは無制限", () => {
    expect(watchlistLimit(true)).toBe(Number.POSITIVE_INFINITY);
  });

  it("無料は3件未満なら追加できる", () => {
    expect(canAddMore(0, false)).toBe(true);
    expect(canAddMore(2, false)).toBe(true);
  });

  it("無料は3件に達したら追加できない", () => {
    expect(canAddMore(3, false)).toBe(false);
    expect(canAddMore(4, false)).toBe(false);
  });

  it("プレミアムは何件でも追加できる", () => {
    expect(canAddMore(100, true)).toBe(true);
  });
});
