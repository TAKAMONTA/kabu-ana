import { describe, expect, it } from "vitest";
import {
  formatChartAxisPrice,
  formatChartPrice,
  formatChartTick,
  formatChartTooltipLabel,
  parseChartDate,
} from "../chartFormat";

describe("parseChartDate", () => {
  it("日足の YYYY-MM-DD を読む", () => {
    expect(parseChartDate("2026-11-13")).toEqual({
      year: 2026,
      month: 11,
      day: 13,
    });
  });

  it("空白区切りの分足（iOS の Date が読めない形式）も読む", () => {
    expect(parseChartDate("2026-11-13 14:35:00")).toEqual({
      year: 2026,
      month: 11,
      day: 13,
      hour: 14,
      minute: 35,
    });
    expect(parseChartDate("2026-11-13T09:05")).toMatchObject({
      hour: 9,
      minute: 5,
    });
  });

  it("解釈できない値は null", () => {
    expect(parseChartDate("not a date")).toBeNull();
    expect(parseChartDate("2026-13-01")).toBeNull();
    expect(parseChartDate(undefined)).toBeNull();
    expect(parseChartDate(12345)).toBeNull();
  });
});

describe("formatChartTick", () => {
  it("1日の分足は時:分", () => {
    expect(formatChartTick("2026-11-13 09:30:00", "1D")).toBe("09:30");
  });

  it("日足しかない1日（日本株）や短期は 月/日", () => {
    expect(formatChartTick("2026-11-13", "1D")).toBe("11/13");
    expect(formatChartTick("2026-11-13 09:30:00", "5D")).toBe("11/13");
    expect(formatChartTick("2026-01-05", "1M")).toBe("1/5");
    expect(formatChartTick("2026-01-05", "1Y")).toBe("1/5");
  });

  it("5年・全期間は 年/月", () => {
    expect(formatChartTick("2022-03-01", "5Y")).toBe("2022/3");
    expect(formatChartTick("2010-12-01", "MAX")).toBe("2010/12");
  });

  it("解釈できない値はそのまま返す", () => {
    expect(formatChartTick("abc", "1M")).toBe("abc");
  });
});

describe("formatChartTooltipLabel", () => {
  it("年月日で出し、分足は時刻も付ける", () => {
    expect(formatChartTooltipLabel("2026-11-13")).toBe("2026年11月13日");
    expect(formatChartTooltipLabel("2026-11-13 14:30:00")).toBe(
      "2026年11月13日 14:30"
    );
  });
});

describe("formatChartPrice / formatChartAxisPrice", () => {
  it("円は小数を出さず桁区切り", () => {
    expect(formatChartPrice(3456.5, "¥")).toBe("¥3,457");
    expect(formatChartAxisPrice(12000, "¥")).toBe("¥12,000");
  });

  it("ドルは価格が小数2桁、目盛りは必要な分だけ", () => {
    expect(formatChartPrice(189.5, "$")).toBe("$189.50");
    expect(formatChartAxisPrice(190, "$")).toBe("$190");
    expect(formatChartAxisPrice(189.25, "$")).toBe("$189.25");
  });

  it("数値でないときは崩れた表記を出さない", () => {
    expect(formatChartPrice(Number.NaN, "¥")).toBe("—");
    expect(formatChartAxisPrice(Number.NaN, "$")).toBe("");
  });
});
