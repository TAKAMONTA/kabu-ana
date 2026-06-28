"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp } from "lucide-react";
import type {
  FinancialHistoryItem,
  SearchResultRatios,
} from "@/hooks/useCompanySearch";
import { formatNumber, formatPercentage } from "@/lib/utils/textUtils";

interface FreePerformanceSummaryProps {
  financialData?: {
    revenue?: string;
    netIncome?: string;
    operatingIncome?: string;
    eps?: string;
    period?: string;
  } | null;
  ratios?: SearchResultRatios | null;
  financialHistory?: FinancialHistoryItem[] | null;
  currencySymbol: string;
}

function formatCurrency(
  value: number | string | null | undefined,
  currency: string
) {
  return formatNumber(value, { currency, compact: true });
}

function formatRatio(value: number | null | undefined) {
  return value == null ? "N/A" : formatPercentage(value * 100);
}

function getSortedHistory(financialHistory?: FinancialHistoryItem[] | null) {
  if (!financialHistory?.length) return [];
  return [...financialHistory].sort((a, b) => b.fiscalYear - a.fiscalYear);
}

function getGrowth(current?: number, previous?: number) {
  if (!current || !previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** ratios 由来は割合(0.05=5%)なので %値(5) に正規化して統一する */
function ratioToPercent(value: number | null | undefined) {
  return value == null ? null : value * 100;
}

function describeTrend(value: number | null) {
  if (value == null) return null;
  if (value >= 10) return "大きく伸びています";
  if (value >= 3) return "堅調に伸びています";
  if (value > -3) return "おおむね横ばいです";
  if (value > -10) return "やや弱含みです";
  return "大きく落ち込んでいます";
}

function describeProfitability(roe?: number, operatingMargin?: number) {
  const roePercent = ratioToPercent(roe);
  const marginPercent = ratioToPercent(operatingMargin);

  if (roePercent == null && marginPercent == null) {
    return "収益性を判断する指標はまだ十分に取得できていません。";
  }

  const comments = [];
  if (roePercent != null) {
    comments.push(
      roePercent >= 10
        ? "ROEは高めで、資本効率は良好です"
        : roePercent >= 5
          ? "ROEは標準的な水準です"
          : "ROEは低めで、資本効率には改善余地があります"
    );
  }
  if (marginPercent != null) {
    comments.push(
      marginPercent >= 10
        ? "営業利益率も高く、本業の収益力は強めです"
        : marginPercent >= 3
          ? "営業利益率は一定の収益力を示しています"
          : "営業利益率は低めで、利益率の改善が確認ポイントです"
    );
  }

  return `${comments.join("。")}。`;
}

function buildPerformanceComment({
  revenueGrowth,
  netIncomeGrowth,
  ratios,
  latestFiscalYear,
}: {
  revenueGrowth: number | null;
  netIncomeGrowth: number | null;
  ratios?: SearchResultRatios | null;
  latestFiscalYear?: number;
}) {
  const revenueTrend = describeTrend(revenueGrowth);
  const profitTrend = describeTrend(netIncomeGrowth);
  const period = latestFiscalYear ? `${latestFiscalYear}年度のデータでは、` : "取得できたデータでは、";

  const growthSentence =
    revenueTrend || profitTrend
      ? `${period}売上は${revenueTrend ?? "確認できません"}。純利益は${profitTrend ?? "確認できません"}。`
      : `${period}売上・利益の成長率はまだ十分に取得できていません。`;

  return `${growthSentence}${describeProfitability(
    ratios?.roe,
    ratios?.operatingMargin
  )}`;
}

export function FreePerformanceSummary({
  financialData,
  ratios,
  financialHistory,
  currencySymbol,
}: FreePerformanceSummaryProps) {
  const sorted = getSortedHistory(financialHistory);
  const latest = sorted[0] ?? null;
  const previous = sorted[1] ?? null;
  const revenue = latest?.revenue ?? financialData?.revenue;
  const operatingIncome =
    latest?.operatingIncome ?? financialData?.operatingIncome;
  const netIncome = latest?.netIncome ?? financialData?.netIncome;
  const eps = latest?.eps ?? financialData?.eps;
  const revenueGrowth =
    ratioToPercent(ratios?.revenueGrowth) ??
    getGrowth(latest?.revenue, previous?.revenue);
  const netIncomeGrowth =
    ratioToPercent(ratios?.niGrowth) ??
    getGrowth(latest?.netIncome, previous?.netIncome);
  const hasAnyData =
    revenue != null ||
    operatingIncome != null ||
    netIncome != null ||
    eps != null ||
    ratios != null ||
    latest != null;

  if (!hasAnyData) return null;

  const metrics = [
    { label: "売上高", value: formatCurrency(revenue, currencySymbol) },
    {
      label: "営業利益",
      value: formatCurrency(operatingIncome, currencySymbol),
    },
    { label: "純利益", value: formatCurrency(netIncome, currencySymbol) },
    { label: "EPS", value: formatCurrency(eps, currencySymbol) },
    { label: "ROE", value: formatRatio(ratios?.roe) },
    { label: "営業利益率", value: formatRatio(ratios?.operatingMargin) },
  ];
  const performanceComment = buildPerformanceComment({
    revenueGrowth,
    netIncomeGrowth,
    ratios,
    latestFiscalYear: latest?.fiscalYear,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          無料で見られる業績サマリー
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          まずは売上・利益・収益性を確認してから、必要に応じてAIに質問できます。
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="mb-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            業績コメント
          </p>
          <p className="text-sm leading-relaxed text-foreground">
            {performanceComment}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {metrics.map(item => (
            <div key={item.label} className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className="mt-1 text-base font-semibold">{item.value}</div>
            </div>
          ))}
        </div>

        {(revenueGrowth != null || netIncomeGrowth != null) && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/30">
            <div className="mb-1 flex items-center gap-2 font-medium text-blue-800 dark:text-blue-200">
              <TrendingUp className="h-4 w-4" />
              成長率の目安
            </div>
            <div className="text-muted-foreground">
              売上成長率: {formatPercentage(revenueGrowth)} / 純利益成長率:{" "}
              {formatPercentage(netIncomeGrowth)}
            </div>
          </div>
        )}

        {latest?.fiscalYear && (
          <p className="text-xs text-muted-foreground">
            表示年度: {latest.fiscalYear}年度
          </p>
        )}
      </CardContent>
    </Card>
  );
}
