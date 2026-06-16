import { describe, expect, it } from "vitest";
import {
  findStocksMentionedInText,
  JPX_STOCK_MASTER,
  JPX_STOCK_MASTER_UPDATED_AT,
} from "../stockMaster";

describe("JPX_STOCK_MASTER", () => {
  it("contains a broad domestic equity master generated from JPX listed company data", () => {
    expect(JPX_STOCK_MASTER.length).toBeGreaterThan(3500);
    expect(JPX_STOCK_MASTER_UPDATED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(JPX_STOCK_MASTER.find(stock => stock.code === "7203")).toMatchObject({
      name: "トヨタ自動車",
      marketSegment: "プライム",
    });
    expect(JPX_STOCK_MASTER.find(stock => stock.code === "3350")).toMatchObject({
      name: "メタプラネット",
    });
    expect(JPX_STOCK_MASTER.find(stock => stock.code === "130A")).toMatchObject({
      marketSegment: "グロース",
    });
  });

  it("excludes ETFs and funds from the stock idea universe", () => {
    expect(JPX_STOCK_MASTER.find(stock => stock.code === "1306")).toBeUndefined();
  });
});

describe("findStocksMentionedInText", () => {
  it("finds less obvious stocks from direct company mentions", () => {
    const matches = findStocksMentionedInText("メタプラネット、ビットコイン追加購入で急騰");

    expect(matches.map(stock => stock.code)).toContain("3350");
  });

  it("prefers the longest company mention instead of substring matches", () => {
    const matches = findStocksMentionedInText("メタプラネット、ビットコイン追加購入で急騰");

    expect(matches.map(stock => stock.code)).not.toContain("2391");
  });

  it("does not match a short company name inside a generic market word", () => {
    const matches = findStocksMentionedInText("本日のランキング【値上がり率】 | 個別株");

    expect(matches.map(stock => stock.code)).not.toContain("8118");
  });

  it("does not turn sector-only headlines into specific stock picks", () => {
    const matches = findStocksMentionedInText("生成AI投資の拡大で半導体関連株に関心");

    expect(matches).toHaveLength(0);
  });

  it("does not confuse source names or bylines with listed company mentions", () => {
    const matches = findStocksMentionedInText(
      "日経平均が続伸、野村證券のストラテジストは大型株優位と分析"
    );

    expect(matches.map(stock => stock.code)).not.toContain("8604");
  });

  it("distinguishes SoftBank Group from the telecom stock", () => {
    const groupMatches = findStocksMentionedInText(
      "ソフトバンクグループ急反発、AI投資への期待が続く"
    );
    const telecomMatches = findStocksMentionedInText(
      "ソフトバンク、通信料金プランの見直しを発表"
    );

    expect(groupMatches.map(stock => stock.code)).toContain("9984");
    expect(groupMatches.map(stock => stock.code)).not.toContain("9434");
    expect(telecomMatches.map(stock => stock.code)).toContain("9434");
  });
});
