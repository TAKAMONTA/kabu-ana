import { describe, expect, it } from "vitest";
import {
  buildAiReferenceLabels,
  buildDataStatus,
  formatShortDate,
  type DataStatusInput,
} from "../dataStatus";

const fullJp: DataStatusInput = {
  companyInfo: { market: "TYO" },
  stockData: { price: 2500, asOf: "2026-09-29" },
  chartData: [{ date: "2026-09-26" }, { date: "2026-09-29" }],
  newsData: [{}, {}, {}],
  financialData: { revenue: "1兆円", period: "2026 (FY)" },
  ratios: { roe: 12.3 },
  financialHistory: [{ fiscalYear: 2024 }, { fiscalYear: 2025 }],
  metadata: { edinetStatus: "ok" },
};

describe("formatShortDate", () => {
  it("YYYY-MM-DD を M月D日 にする", () => {
    expect(formatShortDate("2026-09-02")).toBe("9月2日");
    expect(formatShortDate("2026-09-29 15:00:00")).toBe("9月29日");
  });

  it("解釈できない値は空文字", () => {
    expect(formatShortDate(undefined)).toBe("");
    expect(formatShortDate("Mon, 29 Sep 2026")).toBe("");
  });
});

describe("buildDataStatus", () => {
  it("全部取れたときは基準日つきで ok を返す", () => {
    const items = buildDataStatus(fullJp);
    expect(items.map(i => [i.key, i.state, i.detail])).toEqual([
      ["price", "ok", "9月29日時点"],
      ["chart", "ok", "9月29日まで"],
      ["news", "ok", "3件"],
      ["financial", "ok", "有価証券報告書（2025年度まで）"],
    ]);
  });

  it("株価0・チャート空・ニュース空は missing として欠落を明示する", () => {
    const items = buildDataStatus({
      companyInfo: { market: "TYO" },
      stockData: { price: 0 },
      chartData: [],
      newsData: [],
      financialData: null,
    });
    expect(items.every(i => i.state === "missing")).toBe(true);
  });

  it("基準日が無い株価は「基準日は不明」と正直に出す", () => {
    const [price] = buildDataStatus({
      ...fullJp,
      stockData: { price: 100 },
    });
    expect(price.detail).toBe("取得済み（基準日は不明）");
  });

  it("EDINET が無くても決算データがあれば財務は ok", () => {
    const items = buildDataStatus({
      ...fullJp,
      ratios: null,
      financialHistory: null,
    });
    expect(items[3]).toMatchObject({
      state: "ok",
      detail: "決算データ（2026 (FY)）",
    });
  });

  it("EDINET タイムアウトで財務が無いときは省略した旨を出す", () => {
    const items = buildDataStatus({
      ...fullJp,
      financialData: null,
      ratios: null,
      financialHistory: null,
      metadata: { edinetStatus: "timeout" },
    });
    expect(items[3]).toMatchObject({
      state: "missing",
      detail: "応答が遅いため今回は省略しました",
    });
  });
});

describe("buildAiReferenceLabels", () => {
  it("AI分析へ実際に送るデータだけを並べる（チャートは送らないので含めない）", () => {
    expect(buildAiReferenceLabels(fullJp)).toEqual([
      "株価・指標（9月29日時点）",
      "有価証券報告書（2025年度まで）",
      "ニュース3件",
    ]);
  });

  it("何も取れていなければ空配列", () => {
    expect(
      buildAiReferenceLabels({
        companyInfo: { market: "NASDAQ" },
        stockData: { price: 0 },
        newsData: [],
        financialData: { revenue: "1B" },
      })
    ).toEqual([]);
  });
});
