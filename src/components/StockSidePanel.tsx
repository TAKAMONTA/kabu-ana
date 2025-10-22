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
import { TrendingUp, TrendingDown } from "lucide-react";

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

interface StockSidePanelProps {
  companyInfo: CompanyInfo;
  stockData: StockData;
  financialData?: FinancialData | null;
  currency?: string;
}

// ヘルパー関数：数値をフォーマット
function formatLargeNumber(value: string | number | undefined): string {
  if (!value) return "N/A";
  if (typeof value === "string") {
    // すでにフォーマット済みならそのまま返す
    if (value.includes("M") || value.includes("B") || value.includes("T")) {
      return value;
    }
    value = parseFloat(value);
  }
  if (isNaN(value as number)) return "N/A";

  const num = value as number;
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toFixed(0);
}

export function StockSidePanel({
  companyInfo,
  stockData,
  financialData,
  currency = "$",
}: StockSidePanelProps) {
  const getCurrencySymbol = () => {
    return companyInfo.market === "TYO" ? "¥" : currency;
  };

  const currencySymbol = getCurrencySymbol();
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
              </h2>
              <h1 className="text-2xl font-bold text-foreground line-clamp-2">
                {companyInfo.name}
              </h1>
            </div>

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
            value={formatLargeNumber(stockData.marketCap)}
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
            value={`${stockData.dividend.toFixed(2)}%`}
            trend={stockData.dividend >= 2 ? "up" : stockData.dividend > 0 ? "neutral" : undefined}
          />
          <StatsCard
            label="出来高"
            value={formatLargeNumber(stockData.volume)}
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
              <StatsCard label="売上高" value={financialData.revenue} />
            )}
            {financialData.netIncome && (
              <StatsCard label="純利益" value={financialData.netIncome} />
            )}
            {financialData.cash && (
              <StatsCard
                label="現金・短期投資"
                value={financialData.cash}
              />
            )}
            {financialData.eps && (
              <StatsCard
                label="EPS"
                value={`${currencySymbol}${financialData.eps}`}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* 会社概要 */}
      {companyInfo.description && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">会社概要</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-4">
              {companyInfo.description}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
