import { describe, expect, it } from "vitest";
import { ETF_ALIASES, resolveEtfQueryToCode } from "../etfAliases";
import { normalizeStockText } from "../stockMaster";
import { searchSchema } from "@/lib/validation/schemas";

describe("ETF_ALIASES", () => {
  it("has no duplicate name/alias across the table", () => {
    const allTerms = ETF_ALIASES.flatMap(entry =>
      [entry.name, ...entry.aliases].map(normalizeStockText)
    );

    const uniqueTerms = new Set(allTerms);
    expect(uniqueTerms.size).toBe(allTerms.length);
  });

  it("has unique 4-digit codes for every entry", () => {
    const codes = ETF_ALIASES.map(entry => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^\d{4}$/);
    }
  });

  // 再発防止: name/alias に検索バリデーション(searchSchema)を通過できない文字が
  // 混入すると、resolveEtfQueryToCode単体のラウンドトリップテストは緑のまま
  // 実際のHTTP経路だけが400になる（N-1で発生した回帰）。ここで両方を必ず検証する。
  it.each(
    ETF_ALIASES.flatMap(entry =>
      [entry.name, ...entry.aliases].map(term => [entry.code, term] as const)
    )
  )("name/alias for %s (%s) passes searchSchema validation", (_code, term) => {
    const result = searchSchema.safeParse({ query: term });
    expect(result.success).toBe(true);
  });
});

describe("resolveEtfQueryToCode: round trip", () => {
  it.each(ETF_ALIASES.map(entry => [entry.code, entry.name] as const))(
    "resolves its own full name back to %s (%s)",
    (code, name) => {
      expect(resolveEtfQueryToCode(name)).toBe(code);
    }
  );

  it.each(
    ETF_ALIASES.flatMap(entry =>
      entry.aliases.map(alias => [entry.code, alias] as const)
    )
  )("resolves its own alias back to %s (%s)", (code, alias) => {
    expect(resolveEtfQueryToCode(alias)).toBe(code);
  });
});

describe("resolveEtfQueryToCode: negative cases", () => {
  it("does not resolve generic/brand-only words shared across many ETFs", () => {
    const genericQueries = [
      "ETF",
      "NEXT FUNDS",
      "TOPIX",
      "日経",
      "iシェアーズ",
      "インデックス",
      "上場投信",
    ];
    for (const q of genericQueries) {
      expect(resolveEtfQueryToCode(q)).toBeNull();
    }
  });

  it("does not resolve plain US-ticker-shaped queries that happen to appear inside ETF names", () => {
    const usTickerShaped = ["GOLD", "MSCI", "ONE", "NEXT"];
    for (const q of usTickerShaped) {
      expect(resolveEtfQueryToCode(q)).toBeNull();
    }
  });

  it("does not resolve an individual stock name to an ETF", () => {
    expect(resolveEtfQueryToCode("トヨタ")).toBeNull();
    expect(resolveEtfQueryToCode("ソニー")).toBeNull();
  });

  it("returns null for empty or too-short queries", () => {
    expect(resolveEtfQueryToCode("")).toBeNull();
    expect(resolveEtfQueryToCode("a")).toBeNull();
    expect(resolveEtfQueryToCode("あ")).toBeNull();
  });

  it("returns null for an unrelated query", () => {
    expect(
      resolveEtfQueryToCode("生成AI投資の拡大で半導体関連株に関心")
    ).toBeNull();
  });
});

describe("resolveEtfQueryToCode: positive cases (colloquial searches)", () => {
  it("resolves an ETF by a well-known nickname", () => {
    expect(resolveEtfQueryToCode("日経レバレッジ")).toBe("1570");
    expect(resolveEtfQueryToCode("日経ダブルインバース")).toBe("1357");
  });

  it("resolves the all-country equity ETF by its retail nickname", () => {
    expect(resolveEtfQueryToCode("オルカン")).toBe("2559");
  });

  it("resolves a gold ETF by its colloquial name", () => {
    expect(resolveEtfQueryToCode("金の果実")).toBe("1540");
  });

  it("resolves TOPIX連動型上場投信 to the NEXT FUNDS TOPIX ETF, not a lookalike", () => {
    expect(resolveEtfQueryToCode("TOPIX連動型上場投信")).toBe("1306");
  });
});

describe("resolveEtfQueryToCode: longest-match disambiguation", () => {
  it("resolves the currency-hedged S&P500 ETF to itself, not the unhedged lookalike", () => {
    expect(
      resolveEtfQueryToCode("MAXIS米国株式(S&P500)上場投信(為替ヘッジあり)")
    ).toBe("2630");
    expect(resolveEtfQueryToCode("MAXIS米国株式(S&P500)上場投信")).toBe("2558");
  });

  it("resolves the iShares JPX日経400 ETF to itself, not the NEXT FUNDS lookalike", () => {
    expect(resolveEtfQueryToCode("iシェアーズ JPX日経400 ETF")).toBe("1364");
  });
});

describe("resolveEtfQueryToCode: full-width minus/hyphen variants (N-1 regression)", () => {
  it("resolves the NASDAQ-100 ETF from both the U+2212 and ASCII hyphen spellings", () => {
    expect(
      resolveEtfQueryToCode(
        "NEXT FUNDS NASDAQ−100(為替ヘッジなし)連動型上場投信"
      )
    ).toBe("1545");
    expect(
      resolveEtfQueryToCode(
        "NEXT FUNDS NASDAQ-100(為替ヘッジなし)連動型上場投信"
      )
    ).toBe("1545");
  });

  it("resolves the US treasury 1-3y ETF from both the U+2212 and ASCII hyphen spellings", () => {
    expect(resolveEtfQueryToCode("iシェアーズ米国債1−3年ETF")).toBe("2620");
    expect(resolveEtfQueryToCode("iシェアーズ米国債1-3年ETF")).toBe("2620");
  });

  it("resolves the NOMURA-BPI bond ETF from both the U+2212 and ASCII hyphen spellings", () => {
    expect(
      resolveEtfQueryToCode("NEXT FUNDS国内債券・NOMURA−BPI総合連動型上場投信")
    ).toBe("2510");
    expect(
      resolveEtfQueryToCode("NEXT FUNDS国内債券・NOMURA-BPI総合連動型上場投信")
    ).toBe("2510");
  });
});

describe("resolveEtfQueryToCode: N-3 alias coverage", () => {
  it("resolves newly added product-identifying aliases", () => {
    expect(resolveEtfQueryToCode("ナスダック100")).toBe("1545");
    expect(resolveEtfQueryToCode("全世界株式")).toBe("2559");
    expect(resolveEtfQueryToCode("東証reit指数")).toBe("1343");
    expect(resolveEtfQueryToCode("純金")).toBe("1540");
    expect(resolveEtfQueryToCode("金価格")).toBe("1328");
  });

  it("intentionally has no registered alias for generic multi-product terms", () => {
    // 以下はいずれも「複数のETFがマッチしたが一意に決められず null になる」
    // わけではない（実測: マッチしたtermは0件）。そもそも該当する別名を
    // 意図的にテーブルへ登録していない。理由は、これらの語が複数の実在ETFに
    // 等しく当てはまり、どれか1件を勘で選ぶと誤解決のリスクがあるため:
    //   S&P500 ETF: 1655 / 2558 / 2630 / 2634 のいずれも「S&P500 ETF」
    //   高配当ETF : 1478 / 1489 / 1494 のいずれも「高配当ETF」
    //   米国債ETF : 2255 / 2620 のいずれも「米国債ETF」
    //   金ETF     : 1328(金価格連動) / 1540(現物保管の純金上場信託) の
    //               どちらを指すか一意に決まらない。加えて、東証最大級の
    //               金ETFである 1326(SPDRゴールド・シェア) 自体が現状
    //               このテーブルに未収録（将来1326を収録する際は、
    //               「金ETF」の期待値をnullのままにすべきか再検討すること）。
    // 曖昧な語を勘で1件に決めるより null にして既存経路(market_fast等)へ委ねる。
    const intentionallyUnregistered = [
      "S&P500 ETF",
      "高配当ETF",
      "米国債ETF",
      "金ETF",
    ];
    for (const q of intentionallyUnregistered) {
      expect(resolveEtfQueryToCode(q)).toBeNull();
    }
  });
});
