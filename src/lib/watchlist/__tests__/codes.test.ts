import { describe, it, expect } from "vitest";
import { normalizeWatchlistCode, parseCodesParam } from "../codes";

describe("normalizeWatchlistCode", () => {
  it("4桁の数字コードをそのまま返す", () => {
    expect(normalizeWatchlistCode("7203")).toBe("7203");
  });

  it("英数字混在コードを大文字で返す", () => {
    expect(normalizeWatchlistCode("130a")).toBe("130A");
  });

  it("米国ティッカーを大文字で返す", () => {
    expect(normalizeWatchlistCode("aapl")).toBe("AAPL");
  });

  it("前後の空白を落とす", () => {
    expect(normalizeWatchlistCode("  7203  ")).toBe("7203");
  });

  it("全角を半角に畳む", () => {
    expect(normalizeWatchlistCode("７２０３")).toBe("7203");
  });

  it("空文字・空白のみ・非文字列は null", () => {
    expect(normalizeWatchlistCode("")).toBeNull();
    expect(normalizeWatchlistCode("   ")).toBeNull();
    expect(normalizeWatchlistCode(null)).toBeNull();
    expect(normalizeWatchlistCode(7203)).toBeNull();
  });

  it("Firestore の docId に使えない文字を含むものは null", () => {
    expect(normalizeWatchlistCode("a/b")).toBeNull();
    expect(normalizeWatchlistCode("..")).toBeNull();
    expect(normalizeWatchlistCode("__foo__")).toBeNull();
  });

  it("長すぎるものは null", () => {
    expect(normalizeWatchlistCode("A".repeat(21))).toBeNull();
  });

  it("上限ちょうどの長さは通る", () => {
    expect(normalizeWatchlistCode("A".repeat(20))).toBe("A".repeat(20));
  });

  it("ドット・ハイフンを含む米国ティッカーはそのまま返す", () => {
    expect(normalizeWatchlistCode("brk.b")).toBe("BRK.B");
    expect(normalizeWatchlistCode("bf-b")).toBe("BF-B");
  });

  it("先頭が英数字以外（ドット・ハイフン・アンダースコア）は null", () => {
    expect(normalizeWatchlistCode(".AB")).toBeNull();
    expect(normalizeWatchlistCode("-AB")).toBeNull();
    expect(normalizeWatchlistCode("_AB")).toBeNull();
  });
});

describe("parseCodesParam", () => {
  it("カンマ区切りを配列にする", () => {
    expect(parseCodesParam("7203,6758,2559")).toEqual(["7203", "6758", "2559"]);
  });

  it("空要素と不正コードを捨てる", () => {
    expect(parseCodesParam("7203,,a/b,6758")).toEqual(["7203", "6758"]);
  });

  it("重複を除く", () => {
    expect(parseCodesParam("7203,7203,6758")).toEqual(["7203", "6758"]);
  });

  it("上限を超えた分は切り捨てる（先頭20件を残す）", () => {
    const codes = Array.from({ length: 25 }, (_, i) => `${1000 + i}`).join(",");
    const result = parseCodesParam(codes, 20);
    expect(result).toHaveLength(20);
    expect(result[0]).toBe("1000");
    expect(result[19]).toBe("1019");
  });

  it("max を省略した場合は既定で20件に切り詰める", () => {
    const codes = Array.from({ length: 25 }, (_, i) => `${1000 + i}`).join(",");
    expect(parseCodesParam(codes)).toHaveLength(20);
  });

  it("null や空文字は空配列", () => {
    expect(parseCodesParam(null)).toEqual([]);
    expect(parseCodesParam("")).toEqual([]);
  });

  it("max が0以下やNaNなら空配列", () => {
    expect(parseCodesParam("7203", 0)).toEqual([]);
    expect(parseCodesParam("7203,6758", NaN)).toEqual([]);
  });
});
