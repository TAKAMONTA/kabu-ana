import { normalizeStockText, containsStockTerm } from "./stockMaster";

/**
 * 主要ETFの通称 → 証券コード解決テーブル（手動キュレーション層）。
 *
 * stockMaster.generated.json が ETF・ETN / REIT も収録するようになったため、
 * 「正式名称 → コード」の解決はマスタ側が担う。このテーブルが今も必要なのは、
 * 「オルカン」「金の果実」「日経レバレッジ」のような通称が公式名称に含まれず、
 * 生成データからは決して出てこないため。CURATED_STOCK_ALIASES と同じ位置づけ。
 * `name` はマッチ長比較の基準として残す（マスタ側の全角表記とは別に、
 * ユーザーが打ちやすい半角表記でも解決できるようにする役割がある）。
 *
 * 収録コードは J-Quants API（/equities/master）で実在・名称一致を確認済み。
 *
 * `name` は照合対象であると同時に検索バリデーション（searchSchema）を必ず通過できる
 * 文字集合（半角英数字・半角記号）で統一する。JPX公式表記が全角マイナス(U+2212)や
 * 全角ハイフン(U+FF0D)を使う場合でも、`name` には半角ハイフンを用いること。
 * これらの全角バリアントは normalizeEtfText() で半角ハイフンに畳んでから照合するため、
 * ユーザーが公式表記のまま検索しても解決できる。
 */
export interface EtfAliasEntry {
  code: string;
  name: string;
  aliases: string[];
}

export const ETF_ALIASES: EtfAliasEntry[] = [
  // --- TOPIX / 日経225 連動 ---
  {
    code: "1306",
    name: "NEXT FUNDS TOPIX連動型上場投信",
    aliases: ["ネクストファンズtopix", "nf topix", "topix連動型上場投信"],
  },
  {
    code: "1308",
    name: "上場インデックスファンドTOPIX",
    aliases: ["インデックスファンドtopix"],
  },
  {
    code: "1321",
    name: "NEXT FUNDS 日経225連動型上場投信",
    aliases: ["ネクストファンズ日経225", "nf日経225", "日経225連動型上場投信"],
  },
  {
    code: "1330",
    name: "上場インデックスファンド225",
    aliases: ["インデックスファンド225"],
  },
  {
    code: "1329",
    name: "iシェアーズ・コア日経225 ETF",
    aliases: ["ishares日経225", "iシェアーズ日経225"],
  },
  {
    code: "1348",
    name: "MAXISトピックス上場投信",
    aliases: ["maxis topix", "マクシストピックス"],
  },
  {
    code: "1591",
    name: "NEXT FUNDS JPX日経インデックス400連動型上場投信",
    aliases: ["jpx日経400", "jpx日経400連動型上場投信"],
  },
  {
    code: "1364",
    name: "iシェアーズ JPX日経400 ETF",
    aliases: ["ishares jpx日経400"],
  },

  // --- レバレッジ・インバース ---
  {
    code: "1570",
    name: "NEXT FUNDS 日経平均レバレッジ・インデックス連動型上場投信",
    aliases: ["日経レバレッジ", "日経平均レバレッジ"],
  },
  {
    code: "1357",
    name: "NEXT FUNDS 日経平均ダブルインバース・インデックス連動型上場投信",
    aliases: ["日経ダブルインバース", "ダブルインバース"],
  },
  {
    code: "1568",
    name: "TOPIXブル2倍上場投信",
    aliases: ["topixブル2倍", "トピックスブル2倍"],
  },

  // --- REIT ---
  {
    code: "1343",
    name: "NEXT FUNDS 東証REIT指数連動型上場投信",
    aliases: ["東証reit指数連動型上場投信", "nf reit", "東証reit指数"],
  },
  {
    code: "1476",
    name: "iシェアーズ・コアJリートETF",
    aliases: ["ishares jリート", "コアjリート"],
  },
  {
    code: "2555",
    name: "東証REIT ETF",
    aliases: ["シンプレクスreit"],
  },

  // --- セクター・高配当 ---
  {
    code: "1615",
    name: "NEXT FUNDS 東証銀行業株価指数連動型上場投信",
    aliases: ["東証銀行業株価指数", "銀行業株価指数連動型上場投信"],
  },
  {
    code: "1489",
    name: "NEXT FUNDS 日経平均高配当株50指数連動型上場投信",
    aliases: ["日経高配当50", "日経平均高配当株50"],
  },
  {
    code: "1478",
    name: "iシェアーズ MSCIジャパン高配当利回りETF",
    aliases: ["ishares高配当", "msciジャパン高配当"],
  },
  {
    code: "1494",
    name: "One ETF 高配当日本株",
    aliases: ["one etf高配当", "高配当日本株etf"],
  },

  // --- コモディティ ---
  {
    code: "1540",
    name: "純金上場信託(現物国内保管型)",
    aliases: ["金の果実", "純金上場信託", "純金"],
  },
  {
    code: "1328",
    name: "NEXT FUNDS 金価格連動型上場投信",
    aliases: ["金価格連動型上場投信", "nf gold", "金価格"],
  },
  {
    code: "1699",
    name: "NEXT FUNDS NOMURA原油インデックス連動型上場投信",
    aliases: ["原油etf", "原油インデックス連動型上場投信"],
  },

  // --- 米国株・全世界株 ---
  {
    code: "1655",
    name: "iシェアーズ S&P500 米国株ETF",
    aliases: ["ishares s&p500", "iシェアーズs&p500"],
  },
  {
    code: "2558",
    name: "MAXIS米国株式(S&P500)上場投信",
    aliases: ["maxis s&p500", "マクシスs&p500"],
  },
  {
    code: "2630",
    name: "MAXIS米国株式(S&P500)上場投信(為替ヘッジあり)",
    aliases: ["maxis s&p500 為替ヘッジ", "s&p500為替ヘッジあり"],
  },
  {
    code: "2634",
    name: "NEXT FUNDS S&P500指数(為替ヘッジあり)連動型上場投信",
    aliases: ["nf s&p500 為替ヘッジ"],
  },
  {
    code: "1545",
    name: "NEXT FUNDS NASDAQ-100(為替ヘッジなし)連動型上場投信",
    aliases: [
      "nasdaq100 為替ヘッジなし",
      "ナスダック100為替ヘッジなし",
      "ナスダック100",
    ],
  },
  {
    code: "2568",
    name: "上場インデックスファンド米国株式(NASDAQ100)為替ヘッジなし",
    aliases: [
      "インデックスファンドnasdaq100",
      "ナスダック100インデックスファンド",
    ],
  },
  {
    code: "2559",
    name: "MAXIS全世界株式(オール・カントリー)上場投信",
    aliases: ["オルカン", "オールカントリー", "全世界株式etf", "全世界株式"],
  },
  {
    code: "1657",
    name: "iシェアーズ・コアMSCI先進国株(除く日本)ETF",
    aliases: ["ishares先進国株", "msci先進国株除く日本"],
  },
  {
    code: "1658",
    name: "iシェアーズ・コアMSCI新興国株ETF",
    aliases: ["ishares新興国株", "msci新興国株etf"],
  },

  // --- 債券 ---
  {
    code: "2620",
    name: "iシェアーズ米国債1-3年ETF",
    aliases: ["ishares米国債1-3年", "米国債1-3年etf"],
  },
  {
    code: "2255",
    name: "iシェアーズ米国債20年超ETF",
    aliases: ["ishares米国債20年超", "米国債20年超etf"],
  },
  {
    code: "2510",
    name: "NEXT FUNDS国内債券・NOMURA-BPI総合連動型上場投信",
    aliases: ["nomura-bpi総合", "国内債券bpi"],
  },
];

/**
 * JPX公式表記に現れる全角マイナス(U+2212)・全角ハイフンマイナス(U+FF0D)を
 * 半角ハイフンに畳む。normalizeStockText の NFKC はこれらを畳まないため、
 * ETF別名解決の内部でのみ追加適用する（stockMaster.ts 本体は変更しない）。
 */
function normalizeEtfText(value: string): string {
  return normalizeStockText(value).replace(/[−－]/g, "-");
}

interface EtfSearchTerm {
  code: string;
  term: string;
}

function buildEtfSearchTerms(entry: EtfAliasEntry): string[] {
  return Array.from(
    new Set([entry.name, ...entry.aliases].map(normalizeEtfText))
  ).filter(term => term.length >= 2);
}

// 全エントリの (code, term) を平坦化した索引。
const ETF_SEARCH_INDEX: EtfSearchTerm[] = ETF_ALIASES.flatMap(entry =>
  buildEtfSearchTerms(entry).map(term => ({ code: entry.code, term }))
);

export interface EtfMatch {
  code: string;
  /** マッチした名称/別名の文字数（優先順位の比較に使う） */
  matchLength: number;
}

/**
 * クエリを正規化し、主要ETFの名称・別名にマッチする最有力候補を返す。
 *
 * マッチ方向は「エントリの名称/別名がクエリの中に現れるか」の順方向のみ。
 * 逆方向（クエリが名称の部分文字列に過ぎない場合）は採用しない。
 * これは、ETF名称に含まれる汎用語・ブランド名の断片（例: "GOLD", "MSCI"）が
 * 米国株ティッカーと衝突して誤ってETFコードへ解決されるのを防ぐため。
 *
 * 複数エントリの名称/別名がクエリ内にマッチした場合は、マッチした文字列が
 * 最長のものを採用する（例: ヘッジありの正式名称はヘッジなしの正式名称を
 * 部分文字列として含むため、より長い自分自身の名称を優先させる）。
 * 最長のマッチが異なるコードで並んだ場合は曖昧と判断し null を返す。
 */
export function findBestEtfMatch(query: string): EtfMatch | null {
  const normalizedQuery = normalizeEtfText(query);
  if (normalizedQuery.length < 2) return null;

  let bestLength = 0;
  let bestCodes = new Set<string>();

  for (const { code, term } of ETF_SEARCH_INDEX) {
    if (term.length > normalizedQuery.length) continue;
    if (!containsStockTerm(normalizedQuery, term)) continue;

    if (term.length > bestLength) {
      bestLength = term.length;
      bestCodes = new Set([code]);
    } else if (term.length === bestLength) {
      bestCodes.add(code);
    }
  }

  if (bestCodes.size === 1) {
    return { code: [...bestCodes][0], matchLength: bestLength };
  }
  return null;
}

/**
 * マッチしなければ null（個別株や未収録ETFは呼び出し元の既存経路に委ねる）。
 * 個別株との優先順位比較が必要な場合は findBestEtfMatch を使うこと。
 */
export function resolveEtfQueryToCode(query: string): string | null {
  return findBestEtfMatch(query)?.code ?? null;
}
