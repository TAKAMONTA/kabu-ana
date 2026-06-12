import generatedStockMaster from "./stockMaster.generated.json";

interface GeneratedStock {
  code: string;
  name: string;
  marketSegment: string;
  marketProduct: string;
  sector33: string;
  sector17: string;
}

interface GeneratedStockMaster {
  sourceUrl: string;
  updatedAt: string;
  generatedAt: string;
  stocks: GeneratedStock[];
}

export interface JpxStock extends GeneratedStock {
  aliases: string[];
  searchTerms: string[];
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
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]/u.test(value);
}

function hasJapaneseWordBoundary(text: string, term: string): boolean {
  const japaneseChar = "[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}ー]";
  return new RegExp(`(?<!${japaneseChar})${escapeRegExp(term)}(?!${japaneseChar})`, "u").test(text);
}

function buildSearchTerms(stock: GeneratedStock): string[] {
  const aliases = CURATED_STOCK_ALIASES[stock.code] ?? [];
  return uniqueValues([stock.code, stock.name, ...aliases].map(normalizeStockText)).filter(
    term => term.length >= 2
  );
}

export function containsStockTerm(normalizedText: string, normalizedTerm: string): boolean {
  if (!normalizedText || !normalizedTerm) return false;

  if (/^[a-z0-9+&.\- ]+$/.test(normalizedTerm)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedTerm)}($|[^a-z0-9])`).test(
      normalizedText
    );
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
}));

export const JPX_STOCK_BY_CODE = new Map(JPX_STOCK_MASTER.map(stock => [stock.code, stock]));

interface StockTextMatch {
  stock: JpxStock;
  matchedTerms: string[];
}

function isShadowedMatch(match: StockTextMatch, matches: StockTextMatch[]): boolean {
  return match.matchedTerms.every(term =>
    matches.some(
      other =>
        other.stock.code !== match.stock.code &&
        other.matchedTerms.some(
          otherTerm => otherTerm.length > term.length && otherTerm.includes(term)
        )
    )
  );
}

export function findStocksMentionedInText(text: string, limit = 20): JpxStock[] {
  const normalizedText = normalizeStockText(text);
  if (!normalizedText) return [];

  const matches: StockTextMatch[] = [];
  for (const stock of JPX_STOCK_MASTER) {
    const matchedTerms = stock.searchTerms.filter(term => containsStockTerm(normalizedText, term));
    if (matchedTerms.length > 0) {
      matches.push({ stock, matchedTerms });
    }
  }

  return matches
    .filter(match => !isShadowedMatch(match, matches))
    .slice(0, limit)
    .map(match => match.stock);
}
