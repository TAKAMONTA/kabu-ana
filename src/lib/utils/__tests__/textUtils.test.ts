import { describe, expect, it } from "vitest";

import {
  formatMarketCap,
  formatNumber,
  formatPerShare,
  formatPriceChange,
  formatVolume,
} from "../textUtils";

describe("formatMarketCap", () => {
  it("preserves Japanese market cap units instead of parsing only the leading number", () => {
    expect(formatMarketCap("1.39兆")).toBe("¥1.39兆");
    expect(formatMarketCap("45億円")).toBe("¥45億");
  });

  it("formats English units with the requested currency", () => {
    expect(formatMarketCap("1.23T", { currency: "$" })).toBe("$1.23T");
    expect(formatMarketCap("$950B", { currency: "$" })).toBe("$950B");
  });

  it("formats raw numeric values using currency-appropriate compact units", () => {
    expect(formatMarketCap(1_390_000_000_000, { currency: "¥" })).toBe(
      "¥1.39兆"
    );
    expect(formatMarketCap(1_390_000_000_000, { currency: "$" })).toBe(
      "$1.39T"
    );
  });

  it("円の生の数値は桁区切りつきの 億 で出す", () => {
    expect(formatMarketCap(312_345_000_000, { currency: "¥" })).toBe(
      "¥3,123億"
    );
  });

  it("returns N/A for missing or unparseable values", () => {
    expect(formatMarketCap(null)).toBe("N/A");
    expect(formatMarketCap("N/A")).toBe("N/A");
    expect(formatMarketCap("unknown")).toBe("N/A");
  });
});

describe("formatNumber", () => {
  it("円は 兆・億・万 で表し、英語の T/B/M/K を使わない", () => {
    expect(formatNumber(45_123_000_000_000, { currency: "¥" })).toBe("¥45.1兆");
    expect(formatNumber(312_500_000_000, { currency: "¥" })).toBe("¥3,125億");
    expect(formatNumber(4_560_000_000, { currency: "¥" })).toBe("¥45.6億");
    expect(formatNumber(15_000, { currency: "¥" })).toBe("¥1.5万");
    expect(formatNumber("1390000000000", { currency: "¥" })).toBe("¥1.39兆");
    expect(formatNumber(9_800, { currency: "¥" })).toBe("¥9,800");
  });

  it("丸めで 1万 に届いた値は上の単位に繰り上げる", () => {
    expect(formatNumber(99_996_000, { currency: "¥" })).toBe("¥1億");
  });

  it("赤字は通貨記号の前に符号を付ける", () => {
    expect(formatNumber(-120_000_000, { currency: "¥" })).toBe("-¥1.2億");
    expect(formatNumber(-2_500_000_000, { currency: "$" })).toBe("-$2.5B");
  });

  it("ドルは従来どおり T/B/M/K で短くする", () => {
    expect(formatNumber(391_000_000_000, { currency: "$" })).toBe("$391.0B");
  });

  it("compact: false は桁区切りと小数桁で出す", () => {
    expect(
      formatNumber(1234.5, { currency: "$", compact: false, decimals: 2 })
    ).toBe("$1,234.50");
    expect(
      formatNumber(-0.001, { currency: "¥", compact: false, decimals: 2 })
    ).toBe("¥0.00");
  });

  it("値が無いときは N/A", () => {
    expect(formatNumber(null)).toBe("N/A");
    expect(formatNumber("abc", { currency: "¥" })).toBe("N/A");
  });
});

describe("formatPerShare", () => {
  it("EPS は丸めずに出す（¥1.2K のようにしない）", () => {
    expect(formatPerShare("1234.56", "¥")).toBe("¥1,234.56");
    expect(formatPerShare(6.42, "$")).toBe("$6.42");
    expect(formatPerShare(-12.3, "¥")).toBe("-¥12.30");
  });
});

describe("formatVolume", () => {
  it("株数を 万株・億株 で表す", () => {
    expect(formatVolume(12_345_678)).toBe("1,235万株");
    expect(formatVolume(123_400_000)).toBe("1.23億株");
    expect(formatVolume(45_600)).toBe("4.56万株");
    expect(formatVolume(800)).toBe("800株");
  });

  it("値が無い・0 のときは null（「0株」と出さない）", () => {
    expect(formatVolume(0)).toBeNull();
    expect(formatVolume(null)).toBeNull();
    expect(formatVolume(undefined)).toBeNull();
    expect(formatVolume(Number.NaN)).toBeNull();
  });
});

describe("formatPriceChange", () => {
  it("円は「+¥12 (+0.45%)」の形で、符号を通貨記号の前に付ける", () => {
    expect(formatPriceChange(12, 0.45, "¥")).toBe("+¥12 (+0.45%)");
    expect(formatPriceChange(-12, -0.451, "¥")).toBe("-¥12 (-0.45%)");
    expect(formatPriceChange(-2.5, -0.1, "¥")).toBe("-¥2.5 (-0.10%)");
  });

  it("ドルは小数2桁", () => {
    expect(formatPriceChange(1.234, 0.5, "$")).toBe("+$1.23 (+0.50%)");
    expect(formatPriceChange(-0.5, -0.25, "$")).toBe("-$0.50 (-0.25%)");
  });

  it("変化なし（丸めて 0）のときは符号を付けない", () => {
    expect(formatPriceChange(0, 0, "¥")).toBe("¥0 (0.00%)");
    expect(formatPriceChange(-0.01, -0.001, "¥")).toBe("¥0 (0.00%)");
  });
});
