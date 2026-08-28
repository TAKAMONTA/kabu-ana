import { describe, it, expect } from "vitest";
import { QuotesCache, QUOTES_TTL_MS } from "../quotesCache";

const quote = { close: 3020, changePercent: 1.2, asOf: "2026-08-26" };
// 2026-08-27 10:00 JST
const T0 = Date.UTC(2026, 7, 27, 1, 0, 0);

describe("QuotesCache", () => {
  it("保存した値を取り出せる", () => {
    const cache = new QuotesCache();
    cache.set("7203", quote, T0);
    expect(cache.get("7203", T0)).toEqual(quote);
  });

  it("保存していないコードは null", () => {
    const cache = new QuotesCache();
    expect(cache.get("7203", T0)).toBeNull();
  });

  it("TTL 内なら使い回す", () => {
    const cache = new QuotesCache();
    cache.set("7203", quote, T0);
    expect(cache.get("7203", T0 + QUOTES_TTL_MS - 1)).toEqual(quote);
  });

  it("TTL を過ぎたら null", () => {
    const cache = new QuotesCache();
    cache.set("7203", quote, T0);
    expect(cache.get("7203", T0 + QUOTES_TTL_MS + 1)).toBeNull();
  });

  it("JST の日付が変わったら TTL 内でも null", () => {
    const cache = new QuotesCache();
    // 2026-08-27 23:55 JST に保存
    const late = Date.UTC(2026, 7, 27, 14, 55, 0);
    cache.set("7203", quote, late);
    // 10分後は 2026-08-28 00:05 JST（TTL 15分以内だが日付が変わっている）
    expect(cache.get("7203", late + 10 * 60 * 1000)).toBeNull();
  });

  it("コードごとに独立している", () => {
    const cache = new QuotesCache();
    cache.set("7203", quote, T0);
    expect(cache.get("6758", T0)).toBeNull();
  });
});
