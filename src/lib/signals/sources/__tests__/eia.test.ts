import { describe, expect, it } from "vitest";
import { latestEiaPricePoint, parseEiaData } from "../eia";

describe("EIA adapter", () => {
  it("parses latest point and change", () => {
    const observations = parseEiaData({
      response: { data: [{ period: "2026-05-08", value: "80" }, { period: "2026-05-07", value: "78.5" }] },
    });
    const point = latestEiaPricePoint("wti", "WTI", "USD/bbl", observations);
    expect(point.value).toBe(80);
    expect(point.change24h).toBe(1.5);
  });
});
