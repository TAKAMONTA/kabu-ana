import { describe, expect, it } from "vitest";
import { latestFredPricePoint, parseFredObservations } from "../fred";

describe("FRED adapter", () => {
  it("ignores missing observations", () => {
    const observations = parseFredObservations({
      observations: [{ date: "2026-05-08", value: "20.5" }, { date: "2026-05-07", value: "." }, { date: "2026-05-06", value: "18" }],
    });
    const point = latestFredPricePoint("vix", "VIX", "pt", observations);
    expect(point.value).toBe(20.5);
    expect(point.change24h).toBe(2.5);
  });
});
