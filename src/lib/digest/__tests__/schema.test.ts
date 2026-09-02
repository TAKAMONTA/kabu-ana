import { describe, it, expect } from "vitest";
import { parseDigestResponse } from "../schema";

const valid = JSON.stringify({
  marketLine: "全体は小幅高。",
  stockLines: [{ code: "7203", line: "前日比+1.3%。自動運転報道が材料。" }],
  focusLine: "決算発表の続く週。",
});

describe("parseDigestResponse", () => {
  it("正しいJSONを型付きで返す", () => {
    const r = parseDigestResponse(valid);
    expect(r.marketLine).toBe("全体は小幅高。");
    expect(r.stockLines[0]).toEqual({
      code: "7203",
      line: "前日比+1.3%。自動運転報道が材料。",
    });
    expect(r.focusLine).toBe("決算発表の続く週。");
  });

  it("JSON前後に文章が混ざっていても抽出できる", () => {
    const r = parseDigestResponse(`以下が結果です。\n${valid}\n以上です。`);
    expect(r.stockLines).toHaveLength(1);
  });

  it("JSONでなければ throw", () => {
    expect(() => parseDigestResponse("こんにちは")).toThrow();
  });

  it("marketLine が欠けていれば throw", () => {
    expect(() =>
      parseDigestResponse(JSON.stringify({ stockLines: [], focusLine: "x" }))
    ).toThrow();
  });

  it("stockLines が空配列なら throw", () => {
    expect(() =>
      parseDigestResponse(
        JSON.stringify({ marketLine: "x", stockLines: [], focusLine: "y" })
      )
    ).toThrow();
  });

  it("stockLines が11件以上なら throw", () => {
    const lines = Array.from({ length: 11 }, (_, i) => ({
      code: `${1000 + i}`,
      line: "上昇。",
    }));
    expect(() =>
      parseDigestResponse(
        JSON.stringify({ marketLine: "x", stockLines: lines, focusLine: "y" })
      )
    ).toThrow();
  });

  it("marketLine が空白のみなら throw", () => {
    expect(() =>
      parseDigestResponse(
        JSON.stringify({
          marketLine: "   ",
          stockLines: [{ code: "7203", line: "x" }],
          focusLine: "y",
        })
      )
    ).toThrow();
  });

  it("200字ちょうどは通過し、201字は200字に切り詰められる", () => {
    const exact = "あ".repeat(200);
    const over = "あ".repeat(201);

    const withinLimit = parseDigestResponse(
      JSON.stringify({
        marketLine: exact,
        stockLines: [{ code: "7203", line: "x" }],
        focusLine: "y",
      })
    );
    expect(withinLimit.marketLine).toBe(exact);
    expect(withinLimit.marketLine).toHaveLength(200);

    const overLimit = parseDigestResponse(
      JSON.stringify({
        marketLine: over,
        stockLines: [{ code: "7203", line: "x" }],
        focusLine: "y",
      })
    );
    expect(overLimit.marketLine).toHaveLength(200);
    expect(overLimit.marketLine).toBe(exact);
  });

  it("code が数値なら throw", () => {
    expect(() =>
      parseDigestResponse(
        JSON.stringify({
          marketLine: "x",
          stockLines: [{ code: 7203, line: "y" }],
          focusLine: "z",
        })
      )
    ).toThrow();
  });

  it("未知キーは結果から取り除かれる", () => {
    const r = parseDigestResponse(
      JSON.stringify({
        marketLine: "x",
        stockLines: [{ code: "7203", line: "y", sentiment: "positive" }],
        focusLine: "z",
        extra: "should be removed",
      })
    );
    expect(Object.keys(r)).toEqual(["marketLine", "stockLines", "focusLine"]);
    expect(Object.keys(r.stockLines[0])).toEqual(["code", "line"]);
  });
});
