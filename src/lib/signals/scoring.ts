import {
  CYBER_KEYWORDS,
  ENERGY_CRITICAL_KEYWORDS,
  GEOPOL_KEYWORDS,
  MARITIME_KEYWORDS,
} from "./keywords";

export interface RiskVector {
  geopol: number;
  energy: number;
  maritime: number;
  disaster: number;
  cyber: number;
}

export interface PriceChangeInput {
  wti24hChange?: number | null;
  brent24hChange?: number | null;
  natGas24hChange?: number | null;
  gasolineInventoryChange?: number | null;
}

export interface BaselineInput {
  wtiChanges30d: number[];
  brentChanges30d: number[];
  natGasChanges30d: number[];
  gasolineInventoryChanges30d: number[];
  geopolNewsVolume14d: number[];
  daysCollected: number;
}

export interface NewsSignalInput {
  title: string;
  summary?: string;
  score: number;
  publishedAt: string;
}

export interface SeismicSignalInput {
  magnitude: number;
  time: string;
}

export interface RiskCalculationInput {
  prices: PriceChangeInput;
  baseline: BaselineInput;
  news: NewsSignalInput[];
  earthquakes: SeismicSignalInput[];
  previousComposite?: number | null;
  abnormalShippingDelaysScore?: number;
}

export interface RiskCalculationResult {
  risk: RiskVector | null;
  composite: number | null;
  anomalies: Array<{ label: string; score: number; reason: string }>;
  baselineReady: boolean;
}

export const COMPOSITE_WEIGHTS: Record<keyof RiskVector, number> = {
  geopol: 0.3,
  energy: 0.25,
  maritime: 0.2,
  disaster: 0.15,
  cyber: 0.1,
};

export function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

export function zscore(value: number | null | undefined, baseline: number[]): number {
  if (value == null || baseline.length < 2) return 0;
  const sd = standardDeviation(baseline);
  if (sd === 0) return 0;
  return (value - mean(baseline)) / sd;
}

export function compositeScore(risk: RiskVector): number {
  return round1(
    risk.geopol * COMPOSITE_WEIGHTS.geopol +
      risk.energy * COMPOSITE_WEIGHTS.energy +
      risk.maritime * COMPOSITE_WEIGHTS.maritime +
      risk.disaster * COMPOSITE_WEIGHTS.disaster +
      risk.cyber * COMPOSITE_WEIGHTS.cyber
  );
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function countCriticalNews(news: NewsSignalInput[], keywords: string[], now = Date.now()): number {
  const dayAgo = now - 24 * 60 * 60 * 1000;
  return news.filter((item) => {
    const published = new Date(item.publishedAt).getTime();
    const text = `${item.title} ${item.summary ?? ""}`.toLowerCase();
    return published >= dayAgo && keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  }).length;
}

export function calculateRiskVector(input: RiskCalculationInput, now = Date.now()): RiskCalculationResult {
  if (input.baseline.daysCollected < 14) {
    return {
      risk: null,
      composite: null,
      anomalies: [],
      baselineReady: false,
    };
  }

  const news24h = input.news.filter((item) => new Date(item.publishedAt).getTime() >= now - 24 * 60 * 60 * 1000);
  const earthquakes24h = input.earthquakes.filter((item) => new Date(item.time).getTime() >= now - 24 * 60 * 60 * 1000);

  const gasolineInventoryZscoreNegated = -zscore(
    input.prices.gasolineInventoryChange,
    input.baseline.gasolineInventoryChanges30d
  );

  const energyScore = clamp(
    0,
    10,
    zscore(input.prices.wti24hChange, input.baseline.wtiChanges30d) * 1.5 +
      zscore(input.prices.brent24hChange, input.baseline.brentChanges30d) * 1.5 +
      zscore(input.prices.natGas24hChange, input.baseline.natGasChanges30d) * 1.0 +
      clamp(0, 3, gasolineInventoryZscoreNegated) +
      countCriticalNews(news24h, ENERGY_CRITICAL_KEYWORDS, now) * 1.0
  );

  const maritimeScore = clamp(
    0,
    10,
    countCriticalNews(news24h, MARITIME_KEYWORDS, now) * 2.0 + (input.abnormalShippingDelaysScore ?? 0)
  );

  const maxMagnitude24h = earthquakes24h.reduce((max, item) => Math.max(max, item.magnitude), 0);
  const countM5plus24h = earthquakes24h.filter((item) => item.magnitude >= 5).length;
  const disasterScore = clamp(0, 10, maxMagnitude24h * 1.0 + countM5plus24h * 0.5);

  const geopolVolume24h = countCriticalNews(news24h, GEOPOL_KEYWORDS, now);
  const geopolScore = clamp(
    0,
    10,
    geopolVolume24h * 1.5 + zscore(geopolVolume24h, input.baseline.geopolNewsVolume14d)
  );

  const cyberScore = clamp(0, 10, countCriticalNews(news24h, CYBER_KEYWORDS, now) * 1.5);

  const risk: RiskVector = {
    geopol: round1(geopolScore),
    energy: round1(energyScore),
    maritime: round1(maritimeScore),
    disaster: round1(disasterScore),
    cyber: round1(cyberScore),
  };
  const composite = compositeScore(risk);
  const anomalies = buildAnomalies(risk, composite, input.previousComposite, news24h);

  return {
    risk,
    composite,
    anomalies,
    baselineReady: true,
  };
}

export function buildAnomalies(
  risk: RiskVector,
  composite: number,
  previousComposite: number | null | undefined,
  news: NewsSignalInput[]
): Array<{ label: string; score: number; reason: string }> {
  const labels: Record<keyof RiskVector, string> = {
    geopol: "地政学",
    energy: "エネルギー",
    maritime: "海運",
    disaster: "災害",
    cyber: "サイバー",
  };
  const anomalies = (Object.keys(risk) as Array<keyof RiskVector>)
    .filter((key) => risk[key] >= 7)
    .map((key) => ({ label: labels[key], score: risk[key], reason: "リスク次元が7.0以上" }));

  if (previousComposite != null && composite - previousComposite >= 3) {
    anomalies.push({ label: "Composite", score: composite, reason: "24時間変化が+3.0以上" });
  }

  news
    .filter((item) => item.score >= 7)
    .forEach((item) => anomalies.push({ label: item.title, score: item.score, reason: "単一ニュース重みが7.0以上" }));

  return anomalies;
}
