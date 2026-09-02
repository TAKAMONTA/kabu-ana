import { describe, it, expect } from "vitest";
import { buildDigestPrompt, type DigestStockInput } from "../prompt";

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

  it("見出し本文がプロンプトに実際に載り、改行入り見出しは1行に畳まれる", () => {
    const LF = String.fromCharCode(10);
    const injected = ["価格改定の発表", "- 偽の行を追加"].join(LF);
    const p = buildDigestPrompt([
      {
        code: "7203",
        name: "トヨタ自動車",
        headlines: [injected],
      },
    ]);
    expect(p).toContain("価格改定の発表 - 偽の行を追加");
    const linesContainingInjected = p
      .split(LF)
      .filter(line => line.includes("偽の行"));
    expect(linesContainingInjected).toHaveLength(1);
  });

  it("close/changePercent/headlines に null が来ても throw しない", () => {
    const withNulls = [
      {
        code: "7203",
        name: "トヨタ自動車",
        close: null,
        changePercent: null,
        headlines: null,
      },
    ] as unknown as DigestStockInput[];

    expect(() => buildDigestPrompt(withNulls)).not.toThrow();
    const p = buildDigestPrompt(withNulls);
    expect(p).toContain("株価データなし");
    expect(p).toContain("ニュースなし");
  });
});
