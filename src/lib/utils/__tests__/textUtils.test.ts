import { describe, expect, it } from "vitest";

import { formatMarketCap } from "../textUtils";

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

  it("returns N/A for missing or unparseable values", () => {
    expect(formatMarketCap(null)).toBe("N/A");
    expect(formatMarketCap("N/A")).toBe("N/A");
    expect(formatMarketCap("unknown")).toBe("N/A");
  });
});
