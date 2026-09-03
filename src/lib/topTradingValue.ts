import {
  containsStockTerm,
  JPX_STOCK_MASTER,
  normalizeStockText,
  type JpxStock,
} from "./jpx/stockMaster";
import { normalizeDisplayText } from "./displayText";

/**
 * 銘柄アイデアの母集団は個別株のみ。
 *
 * 銘柄マスタには ETF・ETN / REIT も収録されているが、これらを混ぜると
 * 「TOPIX」「日経平均」「東証REIT」のようにニュース見出しへ日常的に現れる語が
 * そのままETF名の一部として加点され、ランキングが指数連動商品で埋まってしまう。
 * 検索・サジェストは全 assetType を対象にする一方、ここだけは equity に絞る。
 */
export const STOCK_IDEA_UNIVERSE: JpxStock[] = JPX_STOCK_MASTER.filter(
  stock => stock.assetType === "equity"
);

export interface MarketNewsItem {
  title?: string;
  snippet?: string;
  source?: string;
  date?: string;
  link?: string;
  /** freeNews.tsのNewsItem.publishedAtと同じ：ISO 8601(UTC)の発行時刻。あれば date より優先する */
  publishedAt?: string;
}

export interface TradingValueItem {
  rank: number;
  code: string;
  name: string;
  reason: string;
  confidence: number;
  sources: string[];
  signalLabel?: string;
  evidence?: string;
  sourceLinks?: string[];
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  value: number;
  priceDisplay: string;
  changeDisplay: string;
  volumeDisplay: string;
  valueDisplay: string;
}

export interface StableTopTradingResult {
  items: TradingValueItem[];
  source: "news_signal_ranking" | "news_unavailable";
  newsCount: number;
  matchedCount: number;
}

interface BuildStableTopTradingOptions {
  now?: number;
  maxNewsAgeDays?: number;
}

const DEFAULT_MAX_NEWS_AGE_DAYS = 7;
const MIN_ATTENTION_CONFIDENCE = 0.62;
const MAX_ATTENTION_CONFIDENCE = 0.94;
const FLAT_ATTENTION_CONFIDENCE = 0.72;

function blankMarketFields() {
  return {
    price: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    value: 0,
    priceDisplay: "-",
    changeDisplay: "-",
    volumeDisplay: "-",
    valueDisplay: "-",
  };
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function isGenericNewsSource(source: string): boolean {
  const normalized = source.trim().toLowerCase();
  return [
    "google news",
    "google検索",
    "market news",
    "news",
    "ニュース",
  ].includes(normalized);
}

function sourceLabel(item: MarketNewsItem): string {
  const source = item.source?.trim();
  if (source && !isGenericNewsSource(source)) return source;
  return item.title || source || "ニュース";
}

/**
 * Google News RSS などの見出し末尾に付く配信元表記の語彙。
 * ここに載っている語だけを根拠に括弧を除去する（無条件除去はしない）。
 * 「Yahoo」は「Yahoo!ファイナンス」等の部分文字列としてまとめて拾えるため、
 * それらを個別には列挙していない（MINKABU PRESSも同様に「minkabu」で拾える）。
 * 「ニュース」「オンライン」は単独の媒体名ではなく、他の媒体名トークンに続く
 * 汎用サフィックス語として PUBLISHER_SUFFIX_WORDS 側で扱う。
 */
const PUBLISHER_NAME_TOKENS = [
  "フィスコ",
  "株探",
  "kabutan",
  "みんかぶ",
  "minkabu",
  "モーニングスター",
  "ロイター",
  "ブルームバーグ",
  "日経",
  "Yahoo",
  "note",
  "QUICK",
  "ダイヤモンド",
  "ザイ",
];

// 媒体名トークンの後ろに続きうる汎用語。単独ではこれだけで媒体名とは判定しない。
const PUBLISHER_SUFFIX_WORDS = [
  "ニュース",
  "ファイナンス",
  "オンライン",
  "新聞",
  "PRESS",
  "プレス",
  "速報",
  "NEWS",
];

function escapeForPublisherRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PUBLISHER_NAME_ALTERNATION = PUBLISHER_NAME_TOKENS.map(
  escapeForPublisherRegExp
).join("|");

const PUBLISHER_SUFFIX_WORD_ALTERNATION = PUBLISHER_SUFFIX_WORDS.map(
  escapeForPublisherRegExp
).join("|");

// 括弧の中身「全体」が「媒体名トークンで始まり、その後ろは媒体系の汎用語だけ」
// である場合に限って除去対象にする（部分一致だと「(日経平均採用銘柄)」のような
// 正当な括弧まで消えるため）。「(フィスコ)」「(株探ニュース)」「(Yahoo!ファイナンス)」
// 「(ダイヤモンド・オンライン)」「(日経新聞)」「(MINKABU PRESS)」は除去対象、
// 「(日経平均採用銘柄)」「(7203)」のような銘柄コード・社名括弧は対象外。
const PUBLISHER_PAREN_CONTENT_PATTERN = new RegExp(
  `^(?:${PUBLISHER_NAME_ALTERNATION})(?:[!！・\\s\\-]*(?:${PUBLISHER_SUFFIX_WORD_ALTERNATION}))*$`,
  "i"
);

// 末尾に連続する括弧ブロック列（例:「(フィスコ)(3月14日)」）をまとめて捉える。
// 個々の括弧は PAREN_BLOCK_PATTERN で取り出し、媒体名文法に一致するものだけを
// 間引く。手前に非媒体名の括弧があっても、その奥の媒体名括弧まで正しく除去できる
// ようにするための対応（例:「X(フィスコ)(3月14日)」→「X(3月14日)」）。
// stripPublisherSuffix 内で先に NFKC 正規化しているため、比較時点では全角括弧
// 「（）」は既に半角 "(" ")" に正規化済み（全角側の分岐は到達不能なので持たない）。
const TRAILING_PAREN_RUN_PATTERN = /(?:\s*\([^()]*\))+\s*$/u;
const PAREN_BLOCK_PATTERN = /\s*\(([^()]*)\)/gu;

// Google News RSS の定型「タイトル - 配信元」を落とす。最後の " - " を境目に
// 区切るため貪欲マッチを使う（例:「トヨタ - ホンダ提携 - 日経」→「トヨタ - ホンダ提携」、
// 「X-Y - Z」→「X-Y」）。区切り右側（配信元側）自体にハイフンが含まれていても
// 正しく分割できる（例:「X - J-CASTニュース」→「X」）。左側（本文）が空になる
// 場合は媒体名の判定に依存せず元の文字列を返す。NFKC正規化後の比較のため全角
// パイプ「｜」は到達不能なので持たない（全角ハイフン「－」もNFKCで半角化される
// 一方、em/enダッシュ「–」「—」はNFKCで変換されない別文字なので残す）。
const TRAILING_DASH_SUFFIX_PATTERN = /^([\s\S]*)\s+[-–—|]\s+\S[\s\S]*$/u;

function stripTrailingPublisherParens(value: string): string {
  const runMatch = value.match(TRAILING_PAREN_RUN_PATTERN);
  if (!runMatch) return value;

  const run = runMatch[0];
  const prefix = value.slice(0, runMatch.index);

  const parens = Array.from(run.matchAll(PAREN_BLOCK_PATTERN)).map(match => ({
    whole: match[0],
    content: match[1],
  }));

  const keptParens = parens.filter(
    ({ content }) => !PUBLISHER_PAREN_CONTENT_PATTERN.test(content.trim())
  );

  // 媒体名括弧が1つも無ければ元の文字列をそのまま返す（不要な再構成をしない）。
  if (keptParens.length === parens.length) return value;

  const rebuiltSuffix = keptParens
    .map(({ whole }) => whole.trimStart())
    .join("");

  return `${prefix}${rebuiltSuffix}`.trim();
}

export function stripPublisherSuffix(title: string): string {
  const normalized = title.normalize("NFKC").trim();
  if (!normalized) return normalized;

  let result = normalized;

  const dashMatch = result.match(TRAILING_DASH_SUFFIX_PATTERN);
  if (dashMatch && dashMatch[1].trim().length > 0) {
    result = dashMatch[1].trim();
  }

  return stripTrailingPublisherParens(result);
}

const NORMALIZED_PUBLISHER_NAME_TOKENS = new Set(
  PUBLISHER_NAME_TOKENS.map(normalizeStockText)
);

// dedup（記事の同一性判定）専用: 位置を問わず括弧内に媒体名を含む場合は除去する。
// 銘柄マッチ側（stripPublisherSuffix）は誤消去回避のため末尾かつ厳格な文法のみを
// 対象にするが、identityは重複排除の精度を優先し、旧実装と同じ「媒体名を含んで
// いれば消す」判定を維持する（例:「(ダイヤモンド・ザイ)」）。
// 語彙は旧実装の7語（ダイヤモンド|Yahoo|ニュース|オンライン|ザイ|株探|フィスコ）
// のみに絞る。PUBLISHER_NAME_TOKENS / PUBLISHER_SUFFIX_WORDS をそのまま混ぜると
// S3対応で追加した「日経」「ロイター」「QUICK」「note」等まで部分一致してしまい、
// 「(日経平均採用銘柄)」「(ロイター調査)」「(QUICK調べ)」「(note参照)」のような
// 正当な括弧を含む別記事まで同一キーに潰れてしまう。
const LEGACY_LOOSE_PUBLISHER_TOKENS = [
  "ダイヤモンド",
  "Yahoo",
  "ニュース",
  "オンライン",
  "ザイ",
  "株探",
  "フィスコ",
];

const LOOSE_PUBLISHER_TOKEN_ALTERNATION = LEGACY_LOOSE_PUBLISHER_TOKENS.map(
  escapeForPublisherRegExp
).join("|");

const ANY_POSITION_PUBLISHER_PAREN_PATTERN = new RegExp(
  `\\([^()]*(?:${LOOSE_PUBLISHER_TOKEN_ALTERNATION})[^()]*\\)`,
  "giu"
);

function normalizeNewsTitleForIdentity(title: string): string {
  const withoutSourceSuffix = stripPublisherSuffix(title);
  const withoutAnyPositionPublisherParens = withoutSourceSuffix.replace(
    ANY_POSITION_PUBLISHER_PAREN_PATTERN,
    ""
  );

  return withoutAnyPositionPublisherParens
    .toLowerCase()
    .replace(/[「」『』【】()[\]（）｢｣、。,.!！?？:：;；'"“”‘’\s]/g, "")
    .slice(0, 72);
}

export function normalizeMarketNewsIdentity(item: MarketNewsItem): string {
  const title = item.title?.trim();
  if (title) {
    const normalizedTitle = normalizeNewsTitleForIdentity(title);
    if (normalizedTitle) return `title:${normalizedTitle}`;
  }

  if (item.link) {
    return `link:${item.link.replace(/[?#].*$/, "")}`;
  }

  return `fallback:${normalizeStockText(`${item.source ?? ""} ${item.snippet ?? ""}`).slice(0, 72)}`;
}

function dedupeMarketNews(news: MarketNewsItem[]): MarketNewsItem[] {
  const seen = new Set<string>();
  const deduped: MarketNewsItem[] = [];

  for (const item of news) {
    const key = normalizeMarketNewsIdentity(item);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

interface MaterialSignal {
  label: string;
  score: number;
  pattern: RegExp;
}

const MATERIAL_SIGNALS: MaterialSignal[] = [
  { label: "ストップ高", score: 8, pattern: /ストップ高|s高|制限値幅上限/i },
  {
    label: "決算・業績",
    score: 7,
    pattern: /決算|上方修正|増益|最高益|黒字転換|営業利益|純利益|業績/i,
  },
  {
    label: "株主還元",
    score: 6,
    pattern: /自社株買い|増配|復配|配当|株主還元/i,
  },
  {
    label: "受注・提携",
    score: 6,
    pattern: /受注|大型受注|提携|採用|契約|m&a|買収|tob/i,
  },
  {
    label: "値動き",
    score: 5,
    pattern: /急騰|急伸|続伸|反発|買い|値上がり|出来高|物色/i,
  },
  {
    label: "個別材料",
    score: 5,
    pattern: /個別材料|銘柄材料|新聞からの銘柄材料/i,
  },
  {
    label: "政策テーマ",
    score: 4,
    pattern: /政策|政府|補助金|防衛|原発|規制|関税|経済安全保障/i,
  },
  {
    label: "AI・半導体",
    score: 4,
    pattern: /生成ai|ai|半導体|データセンター|hbm/i,
  },
  {
    label: "暗号資産",
    score: 4,
    pattern: /ビットコイン|暗号資産|bitcoin|btc/i,
  },
  {
    label: "新製品・事業",
    score: 3,
    pattern: /新製品|新サービス|新事業|発売|発表|開始/i,
  },
];

function classifyMaterial(item: MarketNewsItem): {
  label: string;
  score: number;
} {
  const text = `${item.title ?? ""} ${item.snippet ?? ""}`;
  const signal = MATERIAL_SIGNALS.find(rule => rule.pattern.test(text));
  return signal
    ? { label: signal.label, score: signal.score }
    : { label: "企業材料", score: 2 };
}

function evidenceText(item: MarketNewsItem): string {
  return (
    item.title?.trim() || item.snippet?.trim() || item.source || "ニュース"
  );
}

function compactEvidence(value: string, maxLength = 64): string {
  const compacted = normalizeDisplayText(value);
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, maxLength)}...`;
}

function attentionConfidence(
  score: number,
  minScore: number,
  maxScore: number
): number {
  if (maxScore <= minScore) return FLAT_ATTENTION_CONFIDENCE;

  const relativeScore = (score - minScore) / (maxScore - minScore);
  const confidence =
    MIN_ATTENTION_CONFIDENCE +
    relativeScore * (MAX_ATTENTION_CONFIDENCE - MIN_ATTENTION_CONFIDENCE);

  return Number(confidence.toFixed(2));
}

function newsTime(date: string | undefined): number | null {
  if (!date) return null;
  const time = new Date(date).getTime();
  return Number.isFinite(time) ? time : null;
}

/** publishedAt（ISO・UTC）があれば優先し、無ければ表示用date文字列にフォールバックする */
function resolveNewsTime(
  date: string | undefined,
  publishedAt: string | undefined
): number | null {
  if (publishedAt) {
    const time = new Date(publishedAt).getTime();
    if (Number.isFinite(time)) return time;
  }
  return newsTime(date);
}

function isNewsWithinWindow(
  item: MarketNewsItem,
  now: number,
  maxAgeDays: number
): boolean {
  const time = resolveNewsTime(item.date, item.publishedAt);
  if (time === null) return !item.date && !item.publishedAt;
  return now - time <= maxAgeDays * 24 * 60 * 60 * 1000;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * UTCの絶対ミリ秒をJST暦日のインデックスに変換する。
 * dateはtoLocaleDateString("ja-JP")由来のローカル日付文字列であり、
 * これをnew Date(date)で絶対時刻へ変換して単純に86_400_000で日数差を
 * 取ると、実行環境のタイムゾーン（Vercel=UTC）によって日バケットの境界が
 * 09:00 JSTにずれ、寄り付き前（07:00-09:00 JST）の当日記事が
 * 「1日前」扱いになってしまう。+9時間ぶん進めてから日境界で切り捨てることで、
 * 実行環境のタイムゾーンに関係なくJST暦日で日数差を計算できる。
 */
function jstDayIndex(ms: number): number {
  return Math.floor((ms + JST_OFFSET_MS) / DAY_MS);
}

// Google Newsは関連度順で返るため、鮮度を一律加点にすると古い強材料が
// 居座り続ける。経過"暦日"（JST基準）に応じて加点を減衰させ、直近の記事ほど
// 上位に出やすくする（0日=+9, 1日=+6, 2日=+3, 3日以上=0）。日付不明（latestNewsTime
// が無い）は0点。マッチ記事ごとに累積すると同じ銘柄が何本もヒットするだけで
// スコアが際限なく積み上がるため、銘柄あたり1回・最新のマッチ記事の時刻だけで加点する。
function freshnessBonus(latestNewsTime: number, now: number): number {
  if (latestNewsTime <= 0) return 0;
  const ageDays = Math.max(0, jstDayIndex(now) - jstDayIndex(latestNewsTime));
  return Math.max(0, 9 - 3 * ageDays);
}

interface ScoredStock {
  stock: JpxStock;
  score: number;
  directScore: number;
  sources: string[];
  sourceLinks: string[];
  evidences: string[];
  sourceKeys: string[];
  matchedAliases: string[];
  signalLabel: string;
  /** マッチした記事の最新時刻（不明なら0）。同点タイブレークに使う */
  latestNewsTime: number;
}

function isShadowedScoredStock(
  entry: ScoredStock,
  entries: ScoredStock[]
): boolean {
  return entry.matchedAliases.every(term =>
    entries.some(
      other =>
        other.stock.code !== entry.stock.code &&
        other.matchedAliases.some(
          otherTerm =>
            otherTerm.length > term.length && otherTerm.includes(term)
        )
    )
  );
}

function selectDiverseScoredStocks(
  entries: ScoredStock[],
  limit: number
): ScoredStock[] {
  const MIN_DISTINCT_SOURCE_ITEMS = 4;
  const selected: ScoredStock[] = [];
  const selectedCodes = new Set<string>();
  const usedSourceKeys = new Set<string>();

  for (const entry of entries) {
    const primarySourceKey = entry.sourceKeys[0];
    if (primarySourceKey && usedSourceKeys.has(primarySourceKey)) continue;

    selected.push(entry);
    selectedCodes.add(entry.stock.code);
    entry.sourceKeys.forEach(key => usedSourceKeys.add(key));

    if (selected.length >= limit) return selected;
  }

  if (selected.length >= MIN_DISTINCT_SOURCE_ITEMS) {
    return selected;
  }

  for (const entry of entries) {
    if (selectedCodes.has(entry.stock.code)) continue;

    selected.push(entry);
    selectedCodes.add(entry.stock.code);

    if (selected.length >= limit) return selected;
  }

  return selected;
}

export function buildStableTopTradingItems(
  news: MarketNewsItem[],
  options: BuildStableTopTradingOptions = {}
): StableTopTradingResult {
  if (news.length === 0) {
    return {
      items: [],
      source: "news_unavailable",
      newsCount: 0,
      matchedCount: 0,
    };
  }

  const now = options.now ?? Date.now();
  const maxNewsAgeDays = options.maxNewsAgeDays ?? DEFAULT_MAX_NEWS_AGE_DAYS;
  const eligibleNews = dedupeMarketNews(
    news.filter(item => isNewsWithinWindow(item, now, maxNewsAgeDays))
  );

  if (eligibleNews.length === 0) {
    return {
      items: [],
      source: "news_unavailable",
      newsCount: 0,
      matchedCount: 0,
    };
  }

  const normalizedNews = eligibleNews.map(item => ({
    item,
    title: normalizeStockText(stripPublisherSuffix(item.title ?? "")),
    snippet: normalizeStockText(stripPublisherSuffix(item.snippet ?? "")),
  }));

  const scored: ScoredStock[] = STOCK_IDEA_UNIVERSE.map(stock => {
    let score = 0;
    let directScore = 0;
    const sources: string[] = [];
    const sourceLinks: string[] = [];
    const evidences: string[] = [];
    const sourceKeys: string[] = [];
    const matchedAliases: string[] = [];
    const materialScores = new Map<string, number>();
    let latestNewsTime = 0;

    normalizedNews.forEach(({ item, title, snippet }) => {
      const titleMatchedTerms = stock.searchTerms.filter(term =>
        containsStockTerm(title, term)
      );
      // フィスコ・noteのように媒体名リストと一致する検索語（銘柄名そのもの）は、
      // snippetのみの一致（配信元表記の混入など）を根拠に載せない。銘柄コードなど
      // 他の検索語はsnippetでも通常どおりマッチしてよい。
      const snippetMatchedTerms = stock.searchTerms.filter(
        term =>
          !NORMALIZED_PUBLISHER_NAME_TOKENS.has(term) &&
          containsStockTerm(snippet, term)
      );
      const matchedTerms = uniqueStrings([
        ...titleMatchedTerms,
        ...snippetMatchedTerms,
      ]);

      if (matchedTerms.length === 0) return;

      const material = classifyMaterial(item);
      const directHitScore = titleMatchedTerms.length > 0 ? 12 : 6;
      score += directHitScore + material.score;
      directScore += directHitScore;
      materialScores.set(
        material.label,
        Math.max(materialScores.get(material.label) ?? 0, material.score)
      );
      matchedAliases.push(...matchedTerms);
      sources.push(sourceLabel(item));
      if (item.link) sourceLinks.push(item.link);
      evidences.push(evidenceText(item));
      sourceKeys.push(normalizeMarketNewsIdentity(item));

      const resolvedTime = resolveNewsTime(item.date, item.publishedAt);
      if (resolvedTime !== null) {
        latestNewsTime = Math.max(latestNewsTime, resolvedTime);
      }
    });

    // 鮮度加点は記事ごとに累積せず、銘柄あたり1回だけ（最新のマッチ記事基準）
    score += freshnessBonus(latestNewsTime, now);

    const signalLabel =
      Array.from(materialScores.entries()).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0] ?? "企業材料";

    return {
      stock,
      score,
      directScore,
      sources: uniqueStrings(sources).slice(0, 2),
      sourceLinks: uniqueStrings(sourceLinks).slice(0, 2),
      evidences: uniqueStrings(evidences).slice(0, 2),
      sourceKeys: uniqueStrings(sourceKeys),
      matchedAliases: uniqueStrings(matchedAliases),
      signalLabel,
      latestNewsTime,
    };
  });

  const visibleScored = scored
    .filter(item => item.directScore > 0)
    .filter((item, _, entries) => !isShadowedScoredStock(item, entries))
    .sort((a, b) => b.score - a.score || b.latestNewsTime - a.latestNewsTime);

  const selectedScored = selectDiverseScoredStocks(visibleScored, 5);
  const selectedScores = selectedScored.map(entry => entry.score);
  const minSelectedScore = Math.min(...selectedScores);
  const maxSelectedScore = Math.max(...selectedScores);

  const matchedItems: TradingValueItem[] = selectedScored.map(
    (entry, index) => {
      const confidence = attentionConfidence(
        entry.score,
        minSelectedScore,
        maxSelectedScore
      );
      const evidence = entry.evidences[0] || entry.sources[0] || "ニュース";

      return {
        rank: index + 1,
        code: entry.stock.code,
        name: normalizeDisplayText(entry.stock.name),
        reason: `${entry.signalLabel}: ${compactEvidence(evidence)}を確認。`,
        confidence,
        sources: entry.sources,
        signalLabel: entry.signalLabel,
        evidence,
        sourceLinks: entry.sourceLinks,
        ...blankMarketFields(),
      };
    }
  );

  return {
    items: matchedItems,
    source: "news_signal_ranking",
    newsCount: eligibleNews.length,
    matchedCount: matchedItems.length,
  };
}
