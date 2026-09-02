import { describe, it, expect } from "vitest";
import { buildDigestPrompt } from "../prompt";

const stocks = [
  {
    code: "7203",
    name: "トヨタ自動車",
    close: 3156,
    changePercent: 1.28,
    asOf: "2026-08-31",
    headlines: ["自動運転を28年から市販車に搭載と報道"],
  },
  { code: "9984", name: "ソフトバンクグループ", headlines: [] },
];

describe("buildDigestPrompt", () => {
  it("全銘柄のコードと名前を含む", () => {
    const p = buildDigestPrompt(stocks);
    expect(p).toContain("7203");
    expect(p).toContain("トヨタ自動車");
    expect(p).toContain("9984");
  });

  it("株価がある銘柄は終値と前日比を含む", () => {
    const p = buildDigestPrompt(stocks);
    expect(p).toContain("3156");
    expect(p).toContain("1.28");
  });

  it("データが無い銘柄は「データなし」「ニュースなし」と明示する", () => {
    const p = buildDigestPrompt(stocks);
    expect(p).toContain("株価データなし");
    expect(p).toContain("ニュースなし");
  });

  it("JSON形式の指定と売買推奨の禁止を含む", () => {
    const p = buildDigestPrompt(stocks);
    expect(p).toContain("marketLine");
    expect(p).toContain("stockLines");
    expect(p).toContain("focusLine");
    expect(p).toContain("売買の推奨");
  });
});
