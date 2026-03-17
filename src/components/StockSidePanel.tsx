"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatsCard } from "./StatsCard";
import { TrendingUp, TrendingDown, Star } from "lucide-react";
import { formatNumber, formatPercentage, formatMarketCap } from "@/lib/utils/textUtils";

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

interface Ratios {
  roe?: number;
  roa?: number;
  operatingMargin?: number;
  netMargin?: number;
  equityRatio?: number;
  currentRatio?: number;
  revenueGrowth?: number;
  dividendYield?: number;
}

interface StockSidePanelProps {
  companyInfo: CompanyInfo;
  stockData: StockData | null;
  financialData?: FinancialData | null;
  currency?: string;
  accountingStandard?: string | null;
  ratios?: Ratios | null;
  watchlist?: {
    enabled: boolean;
    isInWatchlist: boolean;
    isToggling: boolean;
    onToggle: () => void | Promise<void>;
    hint?: string | null;
  };
}

// ヘルパー関数：数値をフォーマット（後方互換性のため残す）
function formatLargeNumber(value: string | number | undefined): string {
  return formatNumber(value, { compact: true });
}

export function StockSidePanel({
  companyInfo,
  stockData,
  financialData,
  currency = "$",
  accountingStandard,
  ratios,
  watchlist,
}: StockSidePanelProps) {
  const getCurrencySymbol = () => {
    return companyInfo.market === "TYO" ? "¥" : currency;
  };

  const currencySymbol = getCurrencySymbol();

  // stockDataがnullの場合はローディング表示
  if (!stockData) {
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
                  {companyInfo.name}
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

  const isUp = stockData.change >= 0;

  // 52週レンジが有効な場合のみプログレスバーを表示
  const show52WeekRange =
    stockData.high52 > 0 && stockData.low52 > 0 && stockData.high52 > stockData.low52;
  const range52WeekPercent = show52WeekRange
    ? ((stockData.price - stockData.low52) / (stockData.high52 - stockData.low52)) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* ヘッダー情報 */}
      <Card className="border-0 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div>
              <h2 className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
                {companyInfo.symbol}
                {accountingStandard && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-normal normal-case">
                    {accountingStandard}
                  </span>
                )}
              </h2>
              <h1 className="text-2xl font-bold text-foreground line-clamp-2">
                {companyInfo.name}
              </h1>
            </div>
            {watchlist?.enabled && (
              <div className="space-y-1.5">
                <Button
                  variant={watchlist.isInWatchlist ? "secondary" : "outline"}
                  className="w-full"
                  onClick={watchlist.onToggle}
                  disabled={watchlist.isToggling}
                >
                  <Star
                    className={`mr-2 h-4 w-4 ${
                      watchlist.isInWatchlist ? "fill-current text-amber-500" : ""
                    }`}
                  />
                  {watchlist.isInWatchlist
                    ? "ウォッチリストから外す"
                    : "ウォッチリストに追加"}
                </Button>
                {watchlist.hint && (
                  <p className="text-xs text-muted-foreground">{watchlist.hint}</p>
                )}
              </div>
            )}

            <Separator className="my-3" />

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">現在値</span>
                <span className="text-3xl font-bold text-foreground">
                  {currencySymbol}
                  {stockData.price.toLocaleString(undefined, {
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
                    className={`font-semibold ${
                      isUp ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {isUp ? "+" : ""}
                    {currencySymbol}
                    {stockData.change.toFixed(2)} ({
                    stockData.changePercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 主要指標 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">主要指標</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatsCard
            label="時価総額"
            value={formatMarketCap(stockData.marketCap)}
            highlight
          />
          <StatsCard
            label="P/E レシオ"
            value={
              typeof stockData.pe === "number"
                ? stockData.pe > 0
                  ? stockData.pe.toFixed(2)
                  : "N/A"
                : stockData.pe || "N/A"
            }
            description="益利回り指標"
          />
          <StatsCard
            label="配当利回り"
            value={formatPercentage(stockData.dividend)}
            trend={stockData.dividend >= 2 ? "up" : stockData.dividend > 0 ? "neutral" : undefined}
          />
          <StatsCard
            label="出来高"
            value={formatNumber(stockData.volume, { compact: true })}
            description={
              stockData.volume > 0
                ? `${(stockData.volume / 1000000).toFixed(1)}M`
                : "データなし"
            }
          />
        </CardContent>
      </Card>


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
                value={formatNumber(financialData.revenue, { currency: currencySymbol, compact: true })}
              />
            )}
            {financialData.netIncome && (
              <StatsCard
                label="純利益"
                value={formatNumber(financialData.netIncome, { currency: currencySymbol, compact: true })}
              />
            )}
            {financialData.cash && (
              <StatsCard
                label="現金・短期投資"
                value={formatNumber(financialData.cash, { currency: currencySymbol, compact: true })}
              />
            )}
            {financialData.eps && (
              <StatsCard
                label="EPS"
                value={formatNumber(financialData.eps, { currency: currencySymbol, decimals: 2 })}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* EDINET DB 財務指標 */}
      {ratios && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">財務指標</CardTitle>
            <CardDescription className="text-xs">出典: EDINET DB</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {ratios.roe != null && (
              <StatsCard
                label="ROE"
                value={`${(ratios.roe * 100).toFixed(1)}%`}
                trend={ratios.roe >= 0.1 ? "up" : ratios.roe >= 0.05 ? "neutral" : undefined}
              />
            )}
            {ratios.roa != null && (
              <StatsCard
                label="ROA"
                value={`${(ratios.roa * 100).toFixed(1)}%`}
              />
            )}
            {ratios.operatingMargin != null && (
              <StatsCard
                label="営業利益率"
                value={`${(ratios.operatingMargin * 100).toFixed(1)}%`}
              />
            )}
            {ratios.equityRatio != null && (
              <StatsCard
                label="自己資本比率"
                value={`${(ratios.equityRatio * 100).toFixed(1)}%`}
              />
            )}
            {ratios.currentRatio != null && (
              <StatsCard
                label="流動比率"
                value={`${(ratios.currentRatio * 100).toFixed(1)}%`}
              />
            )}
            {ratios.revenueGrowth != null && (
              <StatsCard
                label="売上成長率(YoY)"
                value={`${(ratios.revenueGrowth * 100).toFixed(1)}%`}
                trend={ratios.revenueGrowth > 0 ? "up" : ratios.revenueGrowth < 0 ? "down" : "neutral"}
              />
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
