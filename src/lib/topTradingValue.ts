import {
  containsStockTerm,
  JPX_STOCK_MASTER,
  normalizeStockText,
  type JpxStock,
} from "./jpx/stockMaster";
import { normalizeDisplayText } from "./displayText";

export interface MarketNewsItem {
  title?: string;
  snippet?: string;
  source?: string;
  date?: string;
  link?: string;
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

function normalizeNewsTitleForIdentity(title: string): string {
  const withoutSourceSuffix = title
    .normalize("NFKC")
    .replace(/\s+[-–—|｜]\s+[^-–—|｜]+$/u, "")
    .replace(/（[^）]*(ダイヤモンド|Yahoo|ニュース|オンライン|ザイ|株探|フィスコ)[^）]*）/gu, "")
    .replace(/\([^)]*(ダイヤモンド|Yahoo|ニュース|オンライン|ザイ|株探|フィスコ)[^)]*\)/giu, "");

  return withoutSourceSuffix
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
  { label: "決算・業績", score: 7, pattern: /決算|上方修正|増益|最高益|黒字転換|営業利益|純利益|業績/i },
  { label: "株主還元", score: 6, pattern: /自社株買い|増配|復配|配当|株主還元/i },
  { label: "受注・提携", score: 6, pattern: /受注|大型受注|提携|採用|契約|m&a|買収|tob/i },
  { label: "値動き", score: 5, pattern: /急騰|急伸|続伸|反発|買い|値上がり|出来高|物色/i },
  { label: "個別材料", score: 5, pattern: /個別材料|銘柄材料|新聞からの銘柄材料/i },
  { label: "政策テーマ", score: 4, pattern: /政策|政府|補助金|防衛|原発|規制|関税|経済安全保障/i },
  { label: "AI・半導体", score: 4, pattern: /生成ai|ai|半導体|データセンター|hbm/i },
  { label: "暗号資産", score: 4, pattern: /ビットコイン|暗号資産|bitcoin|btc/i },
  { label: "新製品・事業", score: 3, pattern: /新製品|新サービス|新事業|発売|発表|開始/i },
];

function classifyMaterial(item: MarketNewsItem): { label: string; score: number } {
  const text = `${item.title ?? ""} ${item.snippet ?? ""}`;
  const signal = MATERIAL_SIGNALS.find(rule => rule.pattern.test(text));
  return signal ? { label: signal.label, score: signal.score } : { label: "企業材料", score: 2 };
}

function evidenceText(item: MarketNewsItem): string {
  return item.title?.trim() || item.snippet?.trim() || item.source || "ニュース";
}

function compactEvidence(value: string, maxLength = 64): string {
  const compacted = normalizeDisplayText(value);
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, maxLength)}...`;
}

function attentionConfidence(score: number, minScore: number, maxScore: number): number {
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

function isNewsWithinWindow(
  item: MarketNewsItem,
  now: number,
  maxAgeDays: number
): boolean {
  const time = newsTime(item.date);
  if (time === null) return !item.date;
  return now - time <= maxAgeDays * 24 * 60 * 60 * 1000;
}

function isFreshNews(date: string | undefined, now = Date.now()): boolean {
  const time = newsTime(date);
  if (time === null) return false;
  return now - time <= 3 * 24 * 60 * 60 * 1000;
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
}

function isShadowedScoredStock(entry: ScoredStock, entries: ScoredStock[]): boolean {
  return entry.matchedAliases.every(term =>
    entries.some(
      other =>
        other.stock.code !== entry.stock.code &&
        other.matchedAliases.some(
          otherTerm => otherTerm.length > term.length && otherTerm.includes(term)
        )
    )
  );
}

function selectDiverseScoredStocks(entries: ScoredStock[], limit: number): ScoredStock[] {
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
    title: normalizeStockText(item.title ?? ""),
    snippet: normalizeStockText(item.snippet ?? ""),
  }));

  const scored: ScoredStock[] = JPX_STOCK_MASTER.map(stock => {
    let score = 0;
    let directScore = 0;
    const sources: string[] = [];
    const sourceLinks: string[] = [];
    const evidences: string[] = [];
    const sourceKeys: string[] = [];
    const matchedAliases: string[] = [];
    const materialScores = new Map<string, number>();

    normalizedNews.forEach(({ item, title, snippet }) => {
      const titleMatchedTerms = stock.searchTerms.filter(term => containsStockTerm(title, term));
      const snippetMatchedTerms = stock.searchTerms.filter(term =>
        containsStockTerm(snippet, term)
      );
      const matchedTerms = uniqueStrings([...titleMatchedTerms, ...snippetMatchedTerms]);

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

      if (isFreshNews(item.date, now)) {
        score += 1;
      }
    });

    const signalLabel = Array.from(materialScores.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "企業材料";

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
    };
  });

  const visibleScored = scored
    .filter(item => item.directScore > 0)
    .filter((item, _, entries) => !isShadowedScoredStock(item, entries))
    .sort((a, b) => b.score - a.score);

  const selectedScored = selectDiverseScoredStocks(visibleScored, 5);
  const selectedScores = selectedScored.map(entry => entry.score);
  const minSelectedScore = Math.min(...selectedScores);
  const maxSelectedScore = Math.max(...selectedScores);

  const matchedItems: TradingValueItem[] = selectedScored.map((entry, index) => {
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
  });

  return {
    items: matchedItems,
    source: "news_signal_ranking",
    newsCount: eligibleNews.length,
    matchedCount: matchedItems.length,
  };
}
