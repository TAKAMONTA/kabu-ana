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
