import { describe, it, expect } from "vitest";
import { isJpCode } from "../marketDataRouter";

describe("isJpCode", () => {
  it("treats 4-digit as JP", () => {
    expect(isJpCode("7203")).toBe(true);
    expect(isJpCode("トヨタ 7203")).toBe(true);
    expect(isJpCode("5032")).toBe(true);
  });
  it("treats plain ticker as US", () => {
    expect(isJpCode("AAPL")).toBe(false);
    expect(isJpCode("MSFT")).toBe(false);
    expect(isJpCode("BRK.B")).toBe(false);
  });
  it("treats growth-market alphanumeric codes as JP", () => {
    expect(isJpCode("130A")).toBe(true);
    expect(isJpCode("130a")).toBe(true);
  });
  it("treats alphabet-heavy US tickers as US, not JP", () => {
    expect(isJpCode("3COM")).toBe(false);
  });
  it("treats digit3+alpha1 codes as JP", () => {
    expect(isJpCode("506A")).toBe(true);
  });
});
