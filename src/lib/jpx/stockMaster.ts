import generatedStockMaster from "./stockMaster.generated.json";

/**
 * 銘柄の商品種別。scripts/sync-jpx-stock-master.py が JPX の
 * 「市場・商品区分」から決定して stockMaster.generated.json に書き込む。
 * - equity: 内国株式（プライム/スタンダード/グロース）
 * - etf:    ETF・ETN
 * - reit:   REIT・ベンチャーファンド・カントリーファンド・インフラファンド
 */
export type JpxAssetType = "equity" | "etf" | "reit";

interface GeneratedStock {
  code: string;
  name: string;
  marketSegment: string;
  marketProduct: string;
  /** ETF/REIT は JPX 側が "-"。生成時に空文字へ正規化済み。 */
  sector33: string;
  sector17: string;
  assetType: JpxAssetType;
}

interface GeneratedStockMaster {
  sourceUrl: string;
  updatedAt: string;
  generatedAt: string;
  stocks: GeneratedStock[];
}

export interface JpxStock extends GeneratedStock {
  aliases: string[];
  /**
   * ニュース本文スキャン用の語。短すぎる語は誤検出源なので2文字未満を落とす。
   * topTradingValue の銘柄アイデア生成が使う。
   */
  searchTerms: string[];
  /**
   * ユーザーが明示的に打ち込んだ検索クエリとの照合用の語。
   * 正式名称は「本文にたまたま紛れ込む」ことがないため長さで落とさない
   * （例: 9778「昴」は1文字だが検索できなければならない）。
   */
  queryTerms: string[];
}

const generated = generatedStockMaster as GeneratedStockMaster;

export const JPX_STOCK_MASTER_SOURCE_URL = generated.sourceUrl;
export const JPX_STOCK_MASTER_UPDATED_AT = generated.updatedAt;

const CURATED_STOCK_ALIASES: Record<string, string[]> = {
  "1514": ["住石hd", "住石"],
  "1605": ["inpex", "インペックス"],
  "2158": ["fronteo"],
  "2413": ["m3"],
  "2432": ["dena", "ディーエヌエー"],
  "3092": ["zozo"],
  "3099": ["三越伊勢丹"],
  "3350": ["metaplanet", "メタプラ"],
  "3436": ["sumco"],
  "3697": ["shift"],
  "3778": ["さくらネット"],
  "3994": ["money forward"],
  "4063": ["信越化学"],
  "4385": ["mercari"],
  "4443": ["sansan"],
  "4502": ["武田薬品", "武田"],
  "4503": ["アステラス"],
  "4519": ["中外"],
  "4523": ["eisai"],
  "4568": ["daiichi sankyo"],
  "4661": ["olc", "東京ディズニーリゾート"],
  "4751": ["サイバーエージェント", "abema"],
  "4911": ["shiseido"],
  "5019": ["出光"],
  "5020": ["eneos", "eneosホールディングス"],
  "5032": ["anycolor", "にじさんじ"],
  "5108": ["bridgestone"],
  "5253": ["cover", "ホロライブ", "hololive"],
  "5574": ["abeja"],
  "5801": ["古河電工"],
  "5802": ["住友電工"],
  "5803": ["fujikura"],
  "6146": ["disco"],
  "6315": ["towa"],
  "6501": ["日立"],
  "6503": ["三菱電"],
  "6504": ["fuji electric"],
  "6526": ["socionext"],
  "6590": ["芝浦メカ"],
  "6723": ["ルネサス"],
  "6758": ["ソニー", "sony", "playstation", "ps5"],
  "6762": ["tdk"],
  "6857": ["advantest"],
  "6871": ["マイクロニクス"],
  "6902": ["denso"],
  "6920": ["lasertec"],
  "6963": ["rohm"],
  "6981": ["村田製", "murata"],
  "7003": ["三井e&s", "三井e＆s", "三井イーアンドエス"],
  "7011": ["三菱重工"],
  "7012": ["川崎重工"],
  "7013": ["ihi"],
  "7014": ["名村造船"],
  "7201": ["日産"],
  "7203": ["トヨタ", "toyota"],
  "7261": ["mazda"],
  "7267": ["本田技研", "honda"],
  "7270": ["スバル"],
  "7453": ["無印良品", "muji"],
  "7532": ["パンパシ", "ドンキホーテ", "ドン・キホーテ"],
  "7735": ["screen", "screen hd", "スクリーン"],
  "7936": ["asics"],
  "7974": ["nintendo", "switch"],
  "8001": ["伊藤忠"],
  "8002": ["marubeni"],
  "8031": ["三井物"],
  "8035": ["tokyo electron"],
  "8053": ["住友商"],
  "8058": ["三菱商"],
  "8136": ["sanrio"],
  "8233": ["髙島屋"],
  "8306": ["三菱ufj", "mufg"],
  "8316": ["三井住友fg", "smbc"],
  "8411": ["みずほfg", "みずほ"],
  "8591": ["orix"],
  "8604": ["野村hd"],
  "8750": ["第一生命"],
  "8766": ["東京海上"],
  "9020": ["jr東日本"],
  "9022": ["jr東海"],
  "9101": ["郵船"],
  "9104": ["mol"],
  "9107": ["川汽"],
  "9201": ["jal"],
  "9202": ["ana"],
  "9432": ["ntt", "日本電信電話"],
  "9433": ["kddi"],
  "9434": ["softbank"],
  "9501": ["東京電力", "東電"],
  "9503": ["関電"],
  "9509": ["北海電"],
  "9613": ["nttデータ"],
  "9984": ["ソフトバンクg", "softbank group", "arm"],
};

export function normalizeStockText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasJapaneseCharacters(value: string): boolean {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]/u.test(
    value
  );
}

function hasJapaneseWordBoundary(text: string, term: string): boolean {
  const japaneseChar =
    "[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}ー]";
  return new RegExp(
    `(?<!${japaneseChar})${escapeRegExp(term)}(?!${japaneseChar})`,
    "u"
  ).test(text);
}

function buildSearchTerms(stock: GeneratedStock): string[] {
  const aliases = CURATED_STOCK_ALIASES[stock.code] ?? [];
  return uniqueValues(
    [stock.code, stock.name, ...aliases].map(normalizeStockText)
  ).filter(term => term.length >= 2);
}

function buildQueryTerms(stock: GeneratedStock): string[] {
  // 2文字未満を落とすのはニュース本文スキャンの誤検出対策であって、
  // ユーザーが打った検索クエリには当てはまらない。正式名称だけは長さを問わず残す。
  const name = normalizeStockText(stock.name);
  return uniqueValues([...buildSearchTerms(stock), name]);
}

export function containsStockTerm(
  normalizedText: string,
  normalizedTerm: string
): boolean {
  if (!normalizedText || !normalizedTerm) return false;

  // どの分岐も「term が text の部分文字列であること」を必須条件に含むため、
  // 高価な RegExp 構築の前に安価な includes で足切りする（挙動は不変）。
  // マスタが4252件に拡大し、1クエリあたりの照合回数が跳ね上がったため必要。
  if (!normalizedText.includes(normalizedTerm)) return false;

  if (/^[a-z0-9+&.\- ]+$/.test(normalizedTerm)) {
    return new RegExp(
      `(^|[^a-z0-9])${escapeRegExp(normalizedTerm)}($|[^a-z0-9])`
    ).test(normalizedText);
  }

  if (normalizedTerm === "ソフトバンク") {
    return /ソフトバンク(?!グループ)/.test(normalizedText);
  }

  if (hasJapaneseCharacters(normalizedTerm) && normalizedTerm.length <= 4) {
    return hasJapaneseWordBoundary(normalizedText, normalizedTerm);
  }

  return normalizedText.includes(normalizedTerm);
}

export const JPX_STOCK_MASTER: JpxStock[] = generated.stocks.map(stock => ({
  ...stock,
  aliases: CURATED_STOCK_ALIASES[stock.code] ?? [],
  searchTerms: buildSearchTerms(stock),
  queryTerms: buildQueryTerms(stock),
}));

export const JPX_STOCK_BY_CODE = new Map(
  JPX_STOCK_MASTER.map(stock => [stock.code, stock])
);

export interface JpxStockMatch {
  stock: JpxStock;
  matchedTerms: string[];
  /** マッチした語のうち最長の文字数。優先順位の比較に使う。 */
  matchLength: number;
}

interface StockTextMatch {
  stock: JpxStock;
  matchedTerms: string[];
}

function isShadowedMatch(
  match: StockTextMatch,
  matches: StockTextMatch[]
): boolean {
  return match.matchedTerms.every(term =>
    matches.some(
      other =>
        other.stock.code !== match.stock.code &&
        other.matchedTerms.some(
          otherTerm =>
            otherTerm.length > term.length && otherTerm.includes(term)
        )
    )
  );
}

function longestTermLength(terms: string[]): number {
  return terms.reduce((max, term) => Math.max(max, term.length), 0);
}

/**
 * テキスト中で言及されている銘柄を、確度の高い順に返す。
 *
 * 個別株とETF/REITを同一のマスタ配列で走査するため、`isShadowedMatch` の
 * 「長い語が短い語を覆っていれば短い方は誤検出」という規則が資産種別を
 * またいで自動的に効く。ETF正式名称に偶然含まれる短い社名（例:
 * 「iシェアーズ・コアJリートETF」の中の「コア」2359）はこれで落ちる。
 * `・`(U+30FB) は Script=Common で日本語ワード境界の lookbehind を
 * すり抜けるため、境界判定だけでは防げないことに注意。
 *
 * 影に隠れなかった候補どうしは「実際にマッチした語が長い順」で並べ、
 * 同点は個別株優先、次にコード昇順で決定的にする。これにより先頭要素が
 * 「最も強いマッチ」を意味するようになり、searchResolution 側が
 * etfAliases とのマッチ長比較に使う前提が成立する。
 * ただし実測では、全4252銘柄名の自己解決において shadow 判定だけで
 * 曖昧さが解消される（shadow通過後に候補が2件以上残るクエリは0件）ため、
 * この並び替えが効くのは複数銘柄が併記されたテキストに対してのみである。
 */
export function findStockMatchesInText(
  text: string,
  limit = 20
): JpxStockMatch[] {
  const normalizedText = normalizeStockText(text);
  if (!normalizedText) return [];

  const matches: StockTextMatch[] = [];
  for (const stock of JPX_STOCK_MASTER) {
    const matchedTerms = stock.queryTerms.filter(term =>
      containsStockTerm(normalizedText, term)
    );
    if (matchedTerms.length > 0) {
      matches.push({ stock, matchedTerms });
    }
  }

  return matches
    .filter(match => !isShadowedMatch(match, matches))
    .map(match => ({
      stock: match.stock,
      matchedTerms: match.matchedTerms,
      matchLength: longestTermLength(match.matchedTerms),
    }))
    .sort((a, b) => {
      if (b.matchLength !== a.matchLength) return b.matchLength - a.matchLength;
      const aEquity = a.stock.assetType === "equity" ? 0 : 1;
      const bEquity = b.stock.assetType === "equity" ? 0 : 1;
      if (aEquity !== bEquity) return aEquity - bEquity;
      return a.stock.code < b.stock.code ? -1 : 1;
    })
    .slice(0, limit);
}

export function findStocksMentionedInText(
  text: string,
  limit = 20
): JpxStock[] {
  return findStockMatchesInText(text, limit).map(match => match.stock);
}
