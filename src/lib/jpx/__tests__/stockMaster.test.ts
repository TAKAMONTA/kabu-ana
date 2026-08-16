import { describe, expect, it } from "vitest";
import {
  findStockMatchesInText,
  JPX_STOCK_MASTER,
  JPX_STOCK_MASTER_UPDATED_AT,
} from "../stockMaster";
import { STOCK_IDEA_UNIVERSE } from "@/lib/topTradingValue";

describe("JPX_STOCK_MASTER", () => {
  it("contains a broad domestic equity master generated from JPX listed company data", () => {
    expect(JPX_STOCK_MASTER.length).toBeGreaterThan(3500);
    expect(JPX_STOCK_MASTER_UPDATED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(JPX_STOCK_MASTER.find(stock => stock.code === "7203")).toMatchObject(
      {
        name: "トヨタ自動車",
        marketSegment: "プライム",
      }
    );
    expect(JPX_STOCK_MASTER.find(stock => stock.code === "3350")).toMatchObject(
      {
        name: "メタプラネット",
      }
    );
    expect(JPX_STOCK_MASTER.find(stock => stock.code === "130A")).toMatchObject(
      {
        marketSegment: "グロース",
      }
    );
  });

  it("excludes ETFs and funds from the stock idea universe", () => {
    // ETF/REITは検索できる必要があるためマスタには収録する。
    // 一方、ニュース本文とのスコアリングで作る銘柄アイデアの母集団からは
    // 除外する（「TOPIX」「日経平均」等の頻出語で指数連動商品が上位を占めるため）。
    const topixEtf = JPX_STOCK_MASTER.find(stock => stock.code === "1306");
    expect(topixEtf).toMatchObject({ assetType: "etf" });

    expect(
      STOCK_IDEA_UNIVERSE.find(stock => stock.code === "1306")
    ).toBeUndefined();
    expect(
      STOCK_IDEA_UNIVERSE.every(stock => stock.assetType === "equity")
    ).toBe(true);
    expect(STOCK_IDEA_UNIVERSE.length).toBeLessThan(JPX_STOCK_MASTER.length);
    // 個別株はアイデア母集団に残っていること（絞り込みすぎの検知）。
    expect(
      STOCK_IDEA_UNIVERSE.find(stock => stock.code === "7203")
    ).toBeDefined();
  });
});

// 旧 findStocksMentionedInText（本文言及の銘柄コード一覧だけを返す薄いラッパ）は
// 本番呼び出し元がゼロだったうえ、queryTerms 走査へ黙って切り替わっており
// docstring（searchTerms=本文スキャン用）と実装の分担が食い違っていた
// （例: "昴" が本文中で誤ヒットする）。罠を残さないよう削除し、テストは
// 本体の findStockMatchesInText を直接呼ぶ形に寄せる。
describe("findStockMatchesInText", () => {
  it("finds less obvious stocks from direct company mentions", () => {
    const matches = findStockMatchesInText(
      "メタプラネット、ビットコイン追加購入で急騰"
    );

    expect(matches.map(match => match.stock.code)).toContain("3350");
  });

  it("prefers the longest company mention instead of substring matches", () => {
    const matches = findStockMatchesInText(
      "メタプラネット、ビットコイン追加購入で急騰"
    );

    expect(matches.map(match => match.stock.code)).not.toContain("2391");
  });

  it("does not match a short company name inside a generic market word", () => {
    const matches = findStockMatchesInText(
      "本日のランキング【値上がり率】 | 個別株"
    );

    expect(matches.map(match => match.stock.code)).not.toContain("8118");
  });

  it("does not turn sector-only headlines into specific stock picks", () => {
    const matches = findStockMatchesInText(
      "生成AI投資の拡大で半導体関連株に関心"
    );

    expect(matches).toHaveLength(0);
  });

  it("does not confuse source names or bylines with listed company mentions", () => {
    const matches = findStockMatchesInText(
      "日経平均が続伸、野村證券のストラテジストは大型株優位と分析"
    );

    expect(matches.map(match => match.stock.code)).not.toContain("8604");
  });

  it("distinguishes SoftBank Group from the telecom stock", () => {
    const groupMatches = findStockMatchesInText(
      "ソフトバンクグループ急反発、AI投資への期待が続く"
    );
    const telecomMatches = findStockMatchesInText(
      "ソフトバンク、通信料金プランの見直しを発表"
    );

    expect(groupMatches.map(match => match.stock.code)).toContain("9984");
    expect(groupMatches.map(match => match.stock.code)).not.toContain("9434");
    expect(telecomMatches.map(match => match.stock.code)).toContain("9434");
  });

  // マッチ長ソートのガード（レビュー指摘）。ソート句を消しても
  // isShadowedMatch は複数銘柄併記テキストでは効かない（3銘柄とも shadow に
  // 該当しないため全件残る）ので、先頭要素はマスタの並び順（コード昇順）に
  // 依存してしまう。実測: ソート無し(マスタ順) -> 先頭 6857 アドバンテスト、
  // ソート有り -> 先頭 8035 東京エレクトロン（マッチ長8文字で最長）。
  // 「先頭が最強マッチ」という不変条件を実行可能な仕様として固定する。
  it("ranks the longest company mention first when multiple stocks are named together", () => {
    const matches = findStockMatchesInText(
      "東京エレクトロン、アドバンテスト、レーザーテックが上昇"
    );

    expect(matches.map(match => match.stock.code)).toEqual([
      "8035",
      "6857",
      "6920",
    ]);
    expect(matches[0].matchLength).toBeGreaterThan(matches[1].matchLength);
  });

  // レビュー指摘（M-1）: shadow 判定（isShadowedMatch）が実際に守るのは
  // 包含する側（長い名前、この例では 1476 のETF正式名称）であって、
  // coverageHelpers.ts の shadowRiskCandidates が抽出する被包含側（短い名前、
  // ここでは個別株「コア」2359）ではない。shadow フィルタを外すと 2359 が
  // 混入して本テストは RED になることを実測確認済み。
  it("shadows the equity 「コア」(2359) when it is a proper substring of the ETF's official name (1476)", () => {
    const matches = findStockMatchesInText(
      "ｉシェアーズ・コア　Ｊリート　ＥＴＦ"
    );

    expect(matches.map(match => match.stock.code)).toEqual(["1476"]);
  });
});
