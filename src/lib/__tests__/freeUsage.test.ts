import { describe, expect, it } from "vitest";
import { incrementUsageData, parseStoredUsage, todayJst } from "../freeUsage";

describe("todayJst", () => {
  it("日本時間の0時で日付が変わる（UTCの日付を使わない）", () => {
    // 2026-11-15 23:59 UTC = 2026-11-16 08:59 JST
    expect(todayJst(Date.UTC(2026, 10, 15, 23, 59))).toBe("2026-11-16");
    // 2026-11-15 14:59 UTC = 2026-11-15 23:59 JST
    expect(todayJst(Date.UTC(2026, 10, 15, 14, 59))).toBe("2026-11-15");
    // 2026-11-15 15:00 UTC = 2026-11-16 00:00 JST
    expect(todayJst(Date.UTC(2026, 10, 15, 15, 0))).toBe("2026-11-16");
  });
});

describe("parseStoredUsage", () => {
  it("今日の記録ならその回数を使う", () => {
    expect(
      parseStoredUsage(
        JSON.stringify({ date: "2026-11-16", count: 3 }),
        "2026-11-16"
      )
    ).toEqual({ date: "2026-11-16", count: 3 });
  });

  it("別の日の記録・壊れた値・不正な回数は 0 回から数え直す", () => {
    expect(
      parseStoredUsage(
        JSON.stringify({ date: "2026-11-15", count: 5 }),
        "2026-11-16"
      )
    ).toEqual({ date: "2026-11-16", count: 0 });
    expect(parseStoredUsage("{oops", "2026-11-16")).toEqual({
      date: "2026-11-16",
      count: 0,
    });
    expect(
      parseStoredUsage(
        JSON.stringify({ date: "2026-11-16", count: -1 }),
        "2026-11-16"
      )
    ).toEqual({ date: "2026-11-16", count: 0 });
    expect(parseStoredUsage(null, "2026-11-16")).toEqual({
      date: "2026-11-16",
      count: 0,
    });
  });
});

describe("incrementUsageData", () => {
  it("同じ日なら加算し、日付が変わっていたら1回目にする", () => {
    expect(
      incrementUsageData({ date: "2026-11-16", count: 2 }, "2026-11-16")
    ).toEqual({ date: "2026-11-16", count: 3 });
    expect(
      incrementUsageData({ date: "2026-11-15", count: 5 }, "2026-11-16")
    ).toEqual({ date: "2026-11-16", count: 1 });
  });
});
