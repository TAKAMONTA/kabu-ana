import { describe, expect, it } from "vitest";
import { searchSchema } from "@/lib/validation/schemas";
import { JPX_STOCK_MASTER } from "../stockMaster";
import { resolveSearchQuery } from "../searchResolution";
import {
  crossAssetSummary,
  equitiesOf,
  expectedNoMiss,
  missSummary,
  nonEquitiesOf,
  resolveToTarget,
  sampleByStride,
  scanSelfResolution,
} from "./coverageHelpers";

/**
 * 銘柄マスタ全体に対する「名称 → 自コード」の総当たり検証（既定スイート版）。
 *
 * 全件スキャンは実行時間が長すぎるため `npm run test:jpx-fullscan` に切り出し、
 * ここでは決定的な等間隔サンプル＋別名保持銘柄＋実害が観測された明示ケースを回す。
 * サンプルと全件で判定ロジックがぶれないよう、判定は coverageHelpers に集約する。
 */

// 等間隔サンプリングの間隔。既定スイートの実行時間予算に合わせて調整する。
const EQUITY_SAMPLE_STRIDE = 25;
const NON_EQUITY_SAMPLE_STRIDE = 5;

const equities = equitiesOf(JPX_STOCK_MASTER);
const nonEquities = nonEquitiesOf(JPX_STOCK_MASTER);
const equitiesWithAliases = equities.filter(stock => stock.aliases.length > 0);

describe("master composition", () => {
  it("contains both equities and non-equity instruments", () => {
    expect(equities.length).toBeGreaterThan(3500);
    expect(nonEquities.length).toBeGreaterThan(400);
    expect(nonEquities.some(stock => stock.assetType === "etf")).toBe(true);
    expect(nonEquities.some(stock => stock.assetType === "reit")).toBe(true);
  });

  it("keeps sector metadata on equities and normalizes it away on funds", () => {
    const toyota = JPX_STOCK_MASTER.find(stock => stock.code === "7203");
    expect(toyota).toMatchObject({
      assetType: "equity",
      name: "トヨタ自動車",
      sector33: "輸送用機器",
    });

    for (const stock of nonEquities) {
      expect(stock.sector33).toBe("");
      expect(stock.sector17).toBe("");
    }
  });
});

// --- (a) 個別株 → 自コード -------------------------------------------------
describe("(a) equity names resolve to their own code", () => {
  it("resolves a deterministic stride sample of equity names", () => {
    const report = scanSelfResolution(
      sampleByStride(equities, EQUITY_SAMPLE_STRIDE)
    );

    expect(missSummary(report)).toBe(expectedNoMiss(report));
  });

  it("resolves every curated alias holder by name and by alias", () => {
    const report = scanSelfResolution(equitiesWithAliases, {
      includeAliases: true,
    });

    expect(missSummary(report)).toBe(expectedNoMiss(report));
  });

  it.each([
    ["トヨタ", "7203"],
    ["TOYOTA", "7203"],
    ["SONY", "6758"],
    ["NTT", "9432"],
    ["MUFG", "8306"],
    ["コア", "2359"],
  ])('resolves the equity query "%s" to %s', (query, code) => {
    const result = resolveSearchQuery(query);
    expect(result.localJpxStock?.code).toBe(code);
    expect(result.etfCode).toBeNull();
  });
});

// --- (b) ETF等 → 自コード ---------------------------------------------------
describe("(b) non-equity names resolve to their own code", () => {
  it("resolves a deterministic stride sample of ETF/REIT names", () => {
    const report = scanSelfResolution(
      sampleByStride(nonEquities, NON_EQUITY_SAMPLE_STRIDE)
    );

    expect(missSummary(report)).toBe(expectedNoMiss(report));
  });

  it.each([
    ["1306", "TOPIX連動型上場投信"],
    ["1321", "日経225連動型上場投信"],
    ["1655", "iシェアーズ S&P500 米国株ETF"],
    ["2558", "MAXIS米国株式(S&P500)上場投信"],
    ["2559", "オルカン"],
    ["1476", "iシェアーズ・コアJリートETF"],
  ])("resolves the curated ETF alias for %s (%s)", (code, query) => {
    expect(resolveToTarget(query)?.code).toBe(code);
  });

  it("resolves a newly-collected ETF that is absent from etfAliases.ts by name", () => {
    // 1326 SPDRゴールド・シェアは etfAliases.ts に載っていない。
    // マスタ収録によって初めて名称検索が通るようになる代表例。
    const spdrGold = JPX_STOCK_MASTER.find(stock => stock.code === "1326");
    expect(spdrGold?.assetType).toBe("etf");
    expect(resolveToTarget(spdrGold!.name)?.code).toBe("1326");
  });
});

// --- (c) 相互奪取ゼロ -------------------------------------------------------
describe("(c) no cross-asset hijacking between equities and funds", () => {
  it("never resolves a sampled equity name to a fund", () => {
    const report = scanSelfResolution(
      sampleByStride(equities, EQUITY_SAMPLE_STRIDE)
    );

    expect(crossAssetSummary(report.crossAssetMisses)).toBe("0 cross-asset");
  });

  it("never resolves a sampled fund name to an equity", () => {
    const report = scanSelfResolution(
      sampleByStride(nonEquities, NON_EQUITY_SAMPLE_STRIDE)
    );

    expect(crossAssetSummary(report.crossAssetMisses)).toBe("0 cross-asset");
  });

  it("keeps the ・(U+30FB) word-boundary cases resolved to the fund, not the equity 2359", () => {
    // 先行フェーズの実害ケース。U+30FB は Script=Common のため
    // 日本語ワード境界の lookbehind をすり抜け、「コア」が奪ってしまう。
    for (const query of [
      "iシェアーズ・コアJリートETF",
      "iシェアーズ・コアMSCI先進国株(除く日本)ETF",
      "iシェアーズ・コアMSCI新興国株ETF",
      "iシェアーズ・コア日経225 ETF",
    ]) {
      const target = resolveToTarget(query);
      expect(`${query} -> ${target?.code}`).not.toBe(`${query} -> 2359`);
      expect(target?.assetType).not.toBe("equity");
    }
  });

  it("does not let US-ticker-shaped queries fall into fund names", () => {
    for (const query of ["GOLD", "MSCI"]) {
      const result = resolveSearchQuery(query);
      expect(result.etfCode).toBeNull();
      expect(result.localJpxStock).toBeNull();
      expect(result.effectiveQuery).toBe(query);
    }
  });
});

// --- (d) バリデーション通過 -------------------------------------------------
describe("(d) every master name passes searchSchema", () => {
  /** 0件のときは見出しだけ、失敗時のみ内訳を連結する。 */
  const summarize = (label: string, items: string[], limit = 40): string =>
    items.length === 0
      ? `0 ${label}`
      : `${items.length} ${label}\n${items.slice(0, limit).join("\n")}`;

  // 「単体テストは緑なのに実HTTPは400」という乖離を唯一検知できるテスト。
  it("accepts every generated stock name as a search query", () => {
    const rejected = JPX_STOCK_MASTER.filter(
      stock => !searchSchema.safeParse({ query: stock.name }).success
    ).map(stock => `${stock.code} ${stock.name}`);

    expect(summarize("rejected", rejected)).toBe("0 rejected");
  });

  it("keeps every generated stock name within the 100-character limit", () => {
    const tooLong = JPX_STOCK_MASTER.filter(
      stock => stock.name.length > 100
    ).map(stock => `${stock.code} (${stock.name.length}) ${stock.name}`);

    expect(summarize("too long", tooLong)).toBe("0 too long");
  });

  it("uses no character outside the searchSchema character set", () => {
    // ステップ6の恒久保証: 文字単位で許可集合との差分を取る。
    // 名称全体ではなく1文字ずつ検査することで、どの文字が原因かを失敗時に示す。
    const offenders = new Set<string>();
    for (const stock of JPX_STOCK_MASTER) {
      for (const char of stock.name) {
        if (/\s/u.test(char)) continue;
        if (!searchSchema.safeParse({ query: char }).success) {
          offenders.add(
            `${char} (U+${char
              .codePointAt(0)!
              .toString(16)
              .toUpperCase()
              .padStart(4, "0")})`
          );
        }
      }
    }

    expect(summarize("disallowed chars", [...offenders])).toBe(
      "0 disallowed chars"
    );
  });
});
