import { describe, it, expect } from "vitest";
import { isJpCode } from "../marketDataRouter";

describe("isJpCode", () => {
  it("treats 4-digit as JP", () => {
    expect(isJpCode("7203")).toBe(true);
    expect(isJpCode("トヨタ 7203")).toBe(true);
  });
  it("treats plain ticker as US", () => {
    expect(isJpCode("AAPL")).toBe(false);
    expect(isJpCode("MSFT")).toBe(false);
  });
});
