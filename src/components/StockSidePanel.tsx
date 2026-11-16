"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatsCard } from "./StatsCard";
import { TrendingUp, TrendingDown, Star } from "lucide-react";
import { normalizeDisplayText } from "@/lib/displayText";
import {
  formatNumber,
  formatPercentage,
  formatMarketCap,
  formatPerShare,
  formatPriceChange,
  formatVolume,
} from "@/lib/utils/textUtils";

interface CompanyInfo {
  name: string;
  symbol: string;
  market: string;
  description?: string;
}

interface StockData {
  price: number;
  change: number;
  changePercent: number;
  marketCap?: string;
  pe?: string | number;
  dividend: number;
  volume: number;
  high52: number;
  low52: number;
  /** 値の基準日（YYYY-MM-DD） */
  asOf?: string;
}

interface FinancialData {
  revenue?: string;
  netIncome?: string;
  operatingIncome?: string;
  totalAssets?: string;
  cash?: string;
  eps?: string;
  period?: string;
}

interface StockSidePanelProps {
  companyInfo: CompanyInfo;
  stockData: StockData | null;
  financialData?: FinancialData | null;
  currency?: string;
  showPriceHeader?: boolean;
  /** 有価証券報告書ベースの配当利回り（0.034 = 3.4%）。株価APIからは配当が取れないため */
  dividendYield?: number | null;
}

interface StockPriceHeaderCardProps {
  companyInfo: CompanyInfo;
  stockData: StockData | null;
  currency?: string;
  isWatched?: boolean;
  onToggleWatch?: () => void;
}

export function StockPriceHeaderCard({
  companyInfo,
  stockData,
  currency = "$",
  isWatched,
  onToggleWatch,
}: StockPriceHeaderCardProps) {
  const currencySymbol = companyInfo.market === "TYO" ? "¥" : currency;
  const companyName = normalizeDisplayText(companyInfo.name);

  if (!stockData) {
    return (
      <Card className="border-0 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
                  {companyInfo.symbol}
                </h2>
                <h1 className="text-2xl font-bold text-foreground line-clamp-2">
                  {companyName}
                </h1>
              </div>
              {onToggleWatch && (
                <button
                  type="button"
                  onClick={onToggleWatch}
                  aria-label={
                    isWatched
                      ? "ウォッチリストから削除"
                      : "ウォッチリストに追加"
                  }
                  aria-pressed={isWatched}
                  className="shrink-0 p-2 rounded-md hover:bg-accent"
                >
                  <Star
                    className={`w-5 h-5 ${
                      isWatched
                        ? "fill-current text-yellow-500"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              )}
            </div>
            <Separator className="my-3" />
            <div className="text-center py-8 text-muted-foreground">
              株価データを読み込み中...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isUp = stockData.change >= 0;

  return (
    <Card className="border-0 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
                {companyInfo.symbol}
              </h2>
              <h1 className="text-2xl font-bold text-foreground line-clamp-2">
                {companyName}
              </h1>
            </div>
            {onToggleWatch && (
              <button
                type="button"
                onClick={onToggleWatch}
                aria-label={
                  isWatched ? "ウォッチリストから削除" : "ウォッチリストに追加"
                }
                aria-pressed={isWatched}
                className="shrink-0 p-2 rounded-md hover:bg-accent"
              >
                <Star
                  className={`w-5 h-5 ${
                    isWatched
                      ? "fill-current text-yellow-500"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            )}
          </div>

          <Separator className="my-3" />

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">現在値</span>
              <span className="text-3xl font-bold text-foreground">
                {currencySymbol}
                {stockData.price.toLocaleString("ja-JP", {
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">前日比</span>
              <div className="flex items-center gap-2">
                {isUp ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
                <span
                  className={`font-semibold tabular-nums ${
                    isUp
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {formatPriceChange(
                    stockData.change,
                    stockData.changePercent,
                    currencySymbol
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** 2026-11-13 → 11月13日 */
function formatAsOfDate(asOf?: string): string | undefined {
  const m = asOf?.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  return `${Number(m[1])}月${Number(m[2])}日時点`;
}

function formatPrice(value: number, currency: string): string {
  return `${currency}${value.toLocaleString("ja-JP", {
    maximumFractionDigits: currency === "¥" ? 1 : 2,
  })}`;
}

interface MetricItem {
  label: string;
  value: string;
  description?: string;
  highlight?: boolean;
  trend?: "up" | "down" | "neutral";
}

/**
 * 主要指標のうち、値が取れたものだけを並べる。
 * 株価APIは時価総額・PER を返さないことが多く、以前は全銘柄で「N/A」の
 * カードが並んでいた。値の無い指標はカードごと出さない。
 */
function buildKeyMetrics(
  stockData: StockData,
  currencySymbol: string,
  dividendYieldPercent: number | null,
  hasReportDividend: boolean
): MetricItem[] {
  const metrics: MetricItem[] = [];

  const marketCap = formatMarketCap(stockData.marketCap, {
    currency: currencySymbol,
  });
  if (marketCap !== "N/A") {
    metrics.push({ label: "時価総額", value: marketCap, highlight: true });
  }

  const pe =
    typeof stockData.pe === "number" ? stockData.pe : Number(stockData.pe);
  if (Number.isFinite(pe) && pe > 0) {
    metrics.push({
      label: "PER（株価収益率）",
      value: `${pe.toFixed(1)}倍`,
      description: "株価が1株あたり利益の何倍かを示します",
    });
  }

  if (dividendYieldPercent != null) {
    metrics.push({
      label: "配当利回り",
      value: formatPercentage(dividendYieldPercent),
      description: hasReportDividend ? "有価証券報告書ベース" : undefined,
      trend:
        dividendYieldPercent >= 2
          ? "up"
          : dividendYieldPercent > 0
            ? "neutral"
            : undefined,
    });
  }

  if (stockData.high52 > 0 && stockData.low52 > 0) {
    metrics.push({
      label: "過去1年の高値",
      value: formatPrice(stockData.high52, currencySymbol),
    });
    metrics.push({
      label: "過去1年の安値",
      value: formatPrice(stockData.low52, currencySymbol),
    });
  }

  const volume = formatVolume(stockData.volume);
  if (volume) {
    metrics.push({
      label: "出来高",
      value: volume,
      description: formatAsOfDate(stockData.asOf),
    });
  }

  return metrics;
}

export function StockSidePanel({
  companyInfo,
  stockData,
  financialData,
  currency = "$",
  showPriceHeader = true,
  dividendYield = null,
}: StockSidePanelProps) {
  // 株価APIは配当を返さず常に 0 になるため、0 を「0%」と表示しない
  const dividendYieldPercent =
    dividendYield != null && Number.isFinite(dividendYield)
      ? dividendYield * 100
      : stockData && stockData.dividend > 0
        ? stockData.dividend
        : null;
  const getCurrencySymbol = () => {
    return companyInfo.market === "TYO" ? "¥" : currency;
  };

  const currencySymbol = getCurrencySymbol();
  const companyName = normalizeDisplayText(companyInfo.name);

  // stockDataがnullの場合はローディング表示
  if (!stockData) {
    if (!showPriceHeader) {
      return null;
    }
    return (
      <div className="space-y-4">
        <Card className="border-0 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div>
                <h2 className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
                  {companyInfo.symbol}
                </h2>
                <h1 className="text-2xl font-bold text-foreground line-clamp-2">
                  {companyName}
                </h1>
              </div>
              <Separator className="my-3" />
              <div className="text-center py-8 text-muted-foreground">
                株価データを読み込み中...
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const keyMetrics = buildKeyMetrics(
    stockData,
    currencySymbol,
    dividendYieldPercent,
    dividendYield != null
  );

  return (
    <div className="space-y-4">
      {/* ヘッダー情報 */}
      {showPriceHeader && (
        <StockPriceHeaderCard
          companyInfo={companyInfo}
          stockData={stockData}
          currency={currency}
        />
      )}

      {/* 主要指標（値が取れたものだけ） */}
      {keyMetrics.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">主要指標</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {keyMetrics.map(metric => (
              <StatsCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                description={metric.description}
                highlight={metric.highlight}
                trend={metric.trend}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* 財務データ */}
      {financialData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">財務情報</CardTitle>
            {financialData.period && (
              <CardDescription className="text-xs">
                {financialData.period}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {financialData.revenue && (
              <StatsCard
                label="売上高"
                value={formatNumber(financialData.revenue, {
                  currency: currencySymbol,
                  compact: true,
                })}
              />
            )}
            {financialData.netIncome && (
              <StatsCard
                label="純利益"
                value={formatNumber(financialData.netIncome, {
                  currency: currencySymbol,
                  compact: true,
                })}
              />
            )}
            {financialData.cash && (
              <StatsCard
                label="現金・短期投資"
                value={formatNumber(financialData.cash, {
                  currency: currencySymbol,
                  compact: true,
                })}
              />
            )}
            {financialData.eps && (
              <StatsCard
                label="EPS（1株あたり利益）"
                value={formatPerShare(financialData.eps, currencySymbol)}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
