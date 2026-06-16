import { describe, expect, it } from "vitest";
import { SIGNAL_REFRESH_GROUPS } from "../refreshPlan";

describe("SIGNAL_REFRESH_GROUPS", () => {
  it("refreshes source signals before risk and morning brief", () => {
    expect(SIGNAL_REFRESH_GROUPS).toEqual([
      ["/api/signals/prices", "/api/signals/news", "/api/signals/seismic"],
      ["/api/signals/risk"],
      ["/api/signals/claude-brief"],
    ]);
  });
});
