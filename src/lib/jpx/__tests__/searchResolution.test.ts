import { describe, expect, it } from "vitest";
import { resolveSearchQuery } from "../searchResolution";
import { ETF_ALIASES } from "../etfAliases";
import { JPX_STOCK_MASTER } from "../stockMaster";

describe("resolveSearchQuery: ETF round trip (via full precedence chain)", () => {
  // resolveEtfQueryToCode 単体ではなく resolveSearchQuery を通して検証する。
  // C-3で入った「個別株が正式名称の断片を奪う」退行(N-2)は、
  // resolveEtfQueryToCode単体のテストでは検知できなかった。
  it.each(ETF_ALIASES.map(entry => [entry.code, entry.name] as const))(
    "resolves its own full name back to %s (%s)",
    (code, name) => {
      const result = resolveSearchQuery(name);
      expect(result.etfCode).toBe(code);
      expect(result.localJpxStock).toBeNull();
      expect(result.effectiveQuery).toBe(code);
    }
  );

  it.each(
    ETF_ALIASES.flatMap(entry =>
      entry.aliases.map(alias => [entry.code, alias] as const)
    )
  )("resolves its own alias back to %s (%s)", (code, alias) => {
    const result = resolveSearchQuery(alias);
    expect(result.etfCode).toBe(code);
    expect(result.localJpxStock).toBeNull();
    expect(result.effectiveQuery).toBe(code);
  });
});

describe("resolveSearchQuery: individual stocks take precedence when their match is longer or equal", () => {
  it("resolves a well-known individual stock name to itself", () => {
    const result = resolveSearchQuery("トヨタ");
    expect(result.localJpxStock?.code).toBe("7203");
    expect(result.etfCode).toBeNull();
  });

  it('keeps "コア" alone resolved to the individual stock 2359 (no regression)', () => {
    const result = resolveSearchQuery("コア");
    expect(result.localJpxStock?.code).toBe("2359");
    expect(result.etfCode).toBeNull();
  });

  it("does not let the individual stock 2359 hijack ETF full names containing コア (N-2 fix)", () => {
    const cases: Array<[string, string]> = [
      ["iシェアーズ・コアJリートETF", "1476"],
      ["コアjリート", "1476"],
      ["iシェアーズ・コアMSCI先進国株(除く日本)ETF", "1657"],
      ["iシェアーズ・コアMSCI新興国株ETF", "1658"],
      ["iシェアーズ・コア日経225 ETF", "1329"],
    ];
    for (const [query, expectedCode] of cases) {
      const result = resolveSearchQuery(query);
      expect(result.etfCode).toBe(expectedCode);
      expect(result.localJpxStock).toBeNull();
    }
  });
});

describe("resolveSearchQuery: individual stock aliases (CURATED_STOCK_ALIASES)", () => {
  // R-1回帰防止: JPX_STOCK_MASTER の aliases を持つ全エントリについて、
  // 各aliasが resolveSearchQuery 経由で自コードに解決されることを総当たりで検証する。
  // この総当たりが存在しなかったことが、英字別名37件が本文言及マッチに到達できなく
  // なる退行(R-1)を見逃した直接の原因だった。
  const stocksWithAliases = JPX_STOCK_MASTER.filter(
    stock => stock.aliases.length > 0
  );

  it("has at least one JPX stock with curated aliases to test against", () => {
    expect(stocksWithAliases.length).toBeGreaterThan(0);
  });

  it.each(
    stocksWithAliases.flatMap(stock =>
      stock.aliases.map(alias => [stock.code, stock.name, alias] as const)
    )
  )("alias %s (%s) resolves back to %s", (code, _name, alias) => {
    const result = resolveSearchQuery(alias);
    expect(result.localJpxStock?.code).toBe(code);
    expect(result.etfCode).toBeNull();
  });

  // 実際に404の実害が観測された英字別名を明示ケースとしても固定する。
  it.each([
    ["TOYOTA", "7203"],
    ["SONY", "6758"],
    ["NTT", "9432"],
    ["MUFG", "8306"],
  ])('resolves the English alias "%s" to %s explicitly', (query, code) => {
    const result = resolveSearchQuery(query);
    expect(result.localJpxStock?.code).toBe(code);
    expect(result.etfCode).toBeNull();
    expect(result.effectiveQuery).toBe(code);
  });
});

describe("resolveSearchQuery: US-ticker-shaped queries suppress ETF resolution only", () => {
  // "GOLD"/"MSCI" のように、個別株の言及マッチが存在しない米国ティッカー形状の
  // クエリは、ETF名称の断片と衝突しないよう素通しする（C-1の防御）。
  // 一方 "TOYOTA"/"SONY" のように個別株の英字別名として登録されているものは
  // 同じティッカー形状でも個別株側に解決される（上のdescribeで検証済み）。
  // タイトル・内容とも「常に素通し」ではなく「ETF解決だけを抑止する」という
  // 実際の仕様に合わせている（旧タイトルはR-1のバグ挙動を仕様として固定していた）。
  it("does not resolve GOLD/MSCI to an ETF (no matching individual stock mention either)", () => {
    for (const q of ["GOLD", "MSCI"]) {
      const result = resolveSearchQuery(q);
      expect(result.etfCode).toBeNull();
      expect(result.localJpxStock).toBeNull();
      expect(result.effectiveQuery).toBe(q);
    }
  });
});

describe("resolveSearchQuery: direct 4-digit codes pass through to the individual stock master", () => {
  it("resolves a direct code query without touching ETF resolution", () => {
    const result = resolveSearchQuery("7203");
    expect(result.localJpxStock?.code).toBe("7203");
    expect(result.etfCode).toBeNull();
    expect(result.effectiveQuery).toBe("7203");
  });
});
