import { describe, expect, it } from "vitest";
import { derivePulse } from "../derivePulse";

describe("derivePulse", () => {
  it("picks the wti point and counts hot/critical items", () => {
    const result = derivePulse(
      [
        { key: "brent", value: 97.4, change24h: 0.2 },
        { key: "wti", value: 95, change24h: 0.68 },
      ],
      [{ label: "Hot" }, { label: "Critical" }, { label: "Normal" }]
    );
    expect(result.wti).toEqual({ value: 95, change24h: 0.68 });
    expect(result.hotCount).toBe(2);
    expect(result.criticalCount).toBe(1);
  });

  it("returns null wti when the point is missing", () => {
    const result = derivePulse([{ key: "brent", value: 97.4 }], []);
    expect(result.wti).toBeNull();
    expect(result.hotCount).toBe(0);
    expect(result.criticalCount).toBe(0);
  });

  it("nulls out non-numeric values", () => {
    const result = derivePulse(
      [{ key: "wti", value: "95", change24h: null }],
      []
    );
    expect(result.wti).toEqual({ value: null, change24h: null });
  });

  it("handles empty inputs", () => {
    const result = derivePulse([], []);
    expect(result).toEqual({ wti: null, hotCount: 0, criticalCount: 0 });
  });
});
