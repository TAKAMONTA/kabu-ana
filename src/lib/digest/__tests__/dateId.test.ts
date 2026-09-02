import { describe, it, expect } from "vitest";
import { jstDateId } from "../dateId";

describe("jstDateId", () => {
  it("UTC深夜でもJSTの日付を返す", () => {
    // 2026-09-01 23:00 UTC = 2026-09-02 08:00 JST
    expect(jstDateId(Date.UTC(2026, 8, 1, 23, 0, 0))).toBe("2026-09-02");
  });

  it("JSTの0時直前は前日", () => {
    // 2026-09-01 14:59 UTC = 2026-09-01 23:59 JST
    expect(jstDateId(Date.UTC(2026, 8, 1, 14, 59, 0))).toBe("2026-09-01");
  });

  it("JSTの0時ちょうどで日付が変わる", () => {
    // 2026-09-01 15:00 UTC = 2026-09-02 00:00 JST
    expect(jstDateId(Date.UTC(2026, 8, 1, 15, 0, 0))).toBe("2026-09-02");
  });
});
