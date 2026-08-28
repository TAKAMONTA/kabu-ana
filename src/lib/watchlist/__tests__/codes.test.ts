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

  it("上限を超えた分は切り捨てる", () => {
    const codes = Array.from({ length: 25 }, (_, i) => `${1000 + i}`).join(",");
    expect(parseCodesParam(codes, 20)).toHaveLength(20);
  });

  it("null や空文字は空配列", () => {
    expect(parseCodesParam(null)).toEqual([]);
    expect(parseCodesParam("")).toEqual([]);
  });
});
