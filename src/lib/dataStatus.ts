/**
 * 検索結果のうち「何が取れて、何が欠けたか」「いつ時点の値か」を
 * 画面表示用に整理する。外部APIの部分失敗をユーザーに正直に伝え、
 * AI分析が何を根拠にしたかを示すために使う。
 */

import type { FinancialData } from "@/lib/api/marketDataTypes";

export type DataStatusState = "ok" | "missing";

export type DataStatusKey = "price" | "chart" | "news" | "financial";

export interface DataStatusItem {
  key: DataStatusKey;
  label: string;
  state: DataStatusState;
  detail: string;
}

export type EdinetStatus = "ok" | "timeout" | "empty" | "error" | "skipped";

export interface DataStatusInput {
  companyInfo: { market?: string };
  stockData: { price?: number; asOf?: string } | null;
  chartData?: Array<{ date: string }> | null;
  newsData?: unknown[] | null;
  financialData?: FinancialData | null;
  ratios?: object | null;
  financialHistory?: Array<{ fiscalYear: number }> | null;
  metadata?: { edinetStatus?: EdinetStatus } | null;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

/** 2026-09-29 / 2026-09-29 15:00:00 → 9月29日。解釈できなければ空文字 */
export function formatShortDate(value: string | undefined | null): string {
  if (!value) return "";
  const m = value.match(ISO_DATE_PATTERN);
  if (!m) return "";
  return `${Number(m[2])}月${Number(m[3])}日`;
}

function hasAnyValue(record: object | null | undefined) {
  if (!record) return false;
  return Object.values(record).some(
    value => value !== undefined && value !== null && value !== ""
  );
}

function priceStatus(input: DataStatusInput): DataStatusItem {
  const price = input.stockData?.price ?? 0;
  if (!(price > 0)) {
    return {
      key: "price",
      label: "株価",
      state: "missing",
      detail: "取得できませんでした",
    };
  }
  const asOf = formatShortDate(input.stockData?.asOf);
  return {
    key: "price",
    label: "株価",
    state: "ok",
    detail: asOf ? `${asOf}時点` : "取得済み（基準日は不明）",
  };
}

function chartStatus(input: DataStatusInput): DataStatusItem {
  const chart = input.chartData ?? [];
  if (chart.length === 0) {
    return {
      key: "chart",
      label: "チャート",
      state: "missing",
      detail: "取得できませんでした",
    };
  }
  const last = formatShortDate(chart[chart.length - 1]?.date);
  return {
    key: "chart",
    label: "チャート",
    state: "ok",
    detail: last ? `${last}まで` : `${chart.length}件`,
  };
}

function newsStatus(input: DataStatusInput): DataStatusItem {
  const count = input.newsData?.length ?? 0;
  return count > 0
    ? { key: "news", label: "ニュース", state: "ok", detail: `${count}件` }
    : {
        key: "news",
        label: "ニュース",
        state: "missing",
        detail: "関連ニュースが見つかりませんでした",
      };
}

function latestFiscalYear(input: DataStatusInput): number | null {
  const years = (input.financialHistory ?? [])
    .map(item => item.fiscalYear)
    .filter(year => Number.isFinite(year));
  return years.length > 0 ? Math.max(...years) : null;
}

function financialStatus(input: DataStatusInput): DataStatusItem {
  const fiscalYear = latestFiscalYear(input);
  if (fiscalYear !== null || hasAnyValue(input.ratios)) {
    return {
      key: "financial",
      label: "財務",
      state: "ok",
      detail: fiscalYear
        ? `有価証券報告書（${fiscalYear}年度まで）`
        : "有価証券報告書の指標",
    };
  }
  if (hasAnyValue(input.financialData)) {
    const period = input.financialData?.period;
    return {
      key: "financial",
      label: "財務",
      state: "ok",
      detail: period ? `決算データ（${period}）` : "決算データ",
    };
  }
  const edinetStatus = input.metadata?.edinetStatus;
  return {
    key: "financial",
    label: "財務",
    state: "missing",
    detail:
      edinetStatus === "timeout"
        ? "応答が遅いため今回は省略しました"
        : "取得できませんでした",
  };
}

export function buildDataStatus(input: DataStatusInput): DataStatusItem[] {
  return [
    priceStatus(input),
    chartStatus(input),
    newsStatus(input),
    financialStatus(input),
  ];
}

/**
 * メインのAI分析（/api/analyze）に実際に渡しているデータの一覧。
 * 送っていないデータ（チャート・J-Quants決算サマリー）は含めない。
 */
export function buildAiReferenceLabels(input: DataStatusInput): string[] {
  const labels: string[] = [];
  const price = input.stockData?.price ?? 0;
  if (price > 0) {
    const asOf = formatShortDate(input.stockData?.asOf);
    labels.push(asOf ? `株価・指標（${asOf}時点）` : "株価・指標");
  }
  const fiscalYear = latestFiscalYear(input);
  if (fiscalYear !== null || hasAnyValue(input.ratios)) {
    labels.push(
      fiscalYear ? `有価証券報告書（${fiscalYear}年度まで）` : "有価証券報告書"
    );
  }
  const newsCount = input.newsData?.length ?? 0;
  if (newsCount > 0) labels.push(`ニュース${newsCount}件`);
  return labels;
}
