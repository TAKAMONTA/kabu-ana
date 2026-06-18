import { describe, expect, it } from "vitest";
import { normalizeDisplayText } from "../displayText";

describe("normalizeDisplayText", () => {
  it("normalizes full-width latin stock labels for display", () => {
    expect(normalizeDisplayText("ＡＨＣグループ")).toBe("AHCグループ");
    expect(normalizeDisplayText("ＶＮＸ")).toBe("VNX");
  });

  it("compacts whitespace without stripping Japanese text", () => {
    expect(normalizeDisplayText("  三菱ＵＦＪ　フィナンシャル  グループ ")).toBe(
      "三菱UFJ フィナンシャル グループ"
    );
  });
});
