import {
  findStockMatchesInText,
  containsStockTerm,
  normalizeStockText,
  JPX_STOCK_BY_CODE,
  type JpxStock,
} from "./stockMaster";
import { findBestEtfMatch } from "./etfAliases";

/** クエリに含まれる4桁コードのみで銘柄を解決する（本文言及は見ない）。 */
function findLocalJpxStockByCode(query: string): JpxStock | null {
  const normalized = query.normalize("NFKC").trim();
  const code = normalized.match(/\b\d{4}\b/)?.[0];
  return code ? JPX_STOCK_BY_CODE.get(code) || null : null;
}

/**
 * クエリ本文中の銘柄名言及のみで解決する（4桁コードは見ない）。
 * `allowNonEquity: false` のときは ETF/REIT を候補から外す。候補を絞ってから
 * 先頭を取るのではなく、絞った結果の先頭を取ることで、ETFが最有力だった場合でも
 * その下位にいる個別株を取りこぼさない。
 */
function findLocalJpxStockByMention(
  query: string,
  options: { allowNonEquity: boolean }
): JpxStock | null {
  const normalized = query.normalize("NFKC").trim();
  const matches = findStockMatchesInText(normalized);
  const usable = options.allowNonEquity
    ? matches
    : matches.filter(match => match.stock.assetType === "equity");
  return usable[0]?.stock ?? null;
}

/** クエリ内で実際にマッチした銘柄の queryTerms のうち最長の文字数。 */
function localStockMatchLength(stock: JpxStock, query: string): number {
  const normalizedQuery = normalizeStockText(query);
  return stock.queryTerms
    .filter(term => containsStockTerm(normalizedQuery, term))
    .reduce((max, term) => Math.max(max, term.length), 0);
}

/**
 * マスタ由来のヒットを戻り値の形に落とす。個別株は localJpxStock、
 * ETF/REIT は etfCode に載せる（呼び出し側の既存の分岐をそのまま活かすため）。
 */
function toResolvedStock(stock: JpxStock): ResolvedSearchQuery {
  return stock.assetType === "equity"
    ? { localJpxStock: stock, etfCode: null, effectiveQuery: stock.code }
    : { localJpxStock: null, etfCode: stock.code, effectiveQuery: stock.code };
}

/** "AAPL" のような素の米国ティッカー形状のクエリかどうか。 */
export function isLikelyPlainUsTicker(query: string): boolean {
  return /^[A-Z][A-Z.]{0,5}$/i.test(query.trim());
}

export interface ResolvedSearchQuery {
  /** 個別株（JPX内国株式）としてヒットした場合のエントリ */
  localJpxStock: JpxStock | null;
  /**
   * 非個別株（ETF・ETN / REIT等）としてヒットした場合のコード。
   * 銘柄マスタ由来のヒットと etfAliases.ts の通称由来のヒットの双方がここに載る。
   */
  etfCode: string | null;
  /** 以降の市場データAPI呼び出しに渡すべき実効クエリ */
  effectiveQuery: string;
}

/**
 * 検索クエリの優先順位規則を両ルート（/api/search, /api/search-suggestions）で
 * 統一して適用する: 4桁コード直指定 → 銘柄マスタの名称言及マッチ →
 * etfAliases.ts の通称マッチ（マッチ文字列が長い方を優先。同点はマスタ側を優先）。
 *
 * クエリに4桁コードが直接含まれる場合は、マスタにあれば無条件に確定させる
 * （曖昧さの余地がないため）。ETF/REIT もマスタに収録済みなので、ここで
 * 「1306」のようなETFコードもそのまま確定する。
 *
 * それ以外は名称言及マッチを常に計算したうえで、米国ティッカー形状
 * （例: "GOLD", "MSCI"）のクエリに限り**非個別株への解決だけ**を抑止する。
 * この順序は不変条件である。isLikelyPlainUsTicker を言及マッチより前に置くと
 * "TOYOTA" "SONY" "NTT" "MUFG" のような英字の個別株別名（いずれもティッカー形状）
 * が言及マッチに到達できず404になる（先行フェーズR-1の退行）。
 *
 * 銘柄マスタとetfAliasesの両方がマッチした場合は、実際にマッチした文字列が
 * 長い方を採用する。これは、ETFの正式名称に「・コア」のような短い個別株名の
 * 断片が偶然含まれるケース（例: "iシェアーズ・コアJリートETF" が個別株
 * 「コア」に奪われる）を防ぐ。マスタ内部の同種の衝突は findStockMatchesInText の
 * shadow判定で既に解決済み（マッチ長ソートは load-bearing ではなく、複数銘柄が
 * 併記されたテキストで先頭要素が最強マッチになる順序を保証するためのもの）。
 */
export function resolveSearchQuery(query: string): ResolvedSearchQuery {
  const codeMatch = findLocalJpxStockByCode(query);
  if (codeMatch) {
    return toResolvedStock(codeMatch);
  }

  // 米国ティッカー形状のときは GOLD/MSCI のようなETF名称断片との衝突を避けるため
  // 非個別株への解決だけを抑止する（個別株の英字別名はここで抑止しない）。
  const plainUsTicker = isLikelyPlainUsTicker(query);
  const mentionMatch = findLocalJpxStockByMention(query, {
    allowNonEquity: !plainUsTicker,
  });
  const etfMatch = plainUsTicker ? null : findBestEtfMatch(query);

  const stockMatchLength = mentionMatch
    ? localStockMatchLength(mentionMatch, query)
    : 0;
  const etfMatchLength = etfMatch ? etfMatch.matchLength : 0;

  if (
    mentionMatch &&
    stockMatchLength > 0 &&
    stockMatchLength >= etfMatchLength
  ) {
    return toResolvedStock(mentionMatch);
  }

  if (etfMatch) {
    return {
      localJpxStock: null,
      etfCode: etfMatch.code,
      effectiveQuery: etfMatch.code,
    };
  }

  if (mentionMatch) {
    return toResolvedStock(mentionMatch);
  }

  return { localJpxStock: null, etfCode: null, effectiveQuery: query };
}
