"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { ChartPeriodSelector } from "./ChartPeriodSelector";

interface ChartData {
  date: string;
  price: number;
  volume: number;
  keyEvent?: {
    title: string;
    link: string;
    source: string;
  };
}

interface StockChartProps {
  symbol: string;
  data?: ChartData[];
  isLoading?: boolean;
  currency?: string;
  onPeriodChange?: (period: string) => void;
}

const PERIOD_LABELS: Record<string, string> = {
  "1D": "1日",
  "5D": "5日",
  "1M": "1ヶ月",
  "6M": "6ヶ月",
  "1Y": "1年",
  "5Y": "5年",
  MAX: "全期間",
};

function formatPrice(value: number, currency: string) {
  return `${currency}${value.toLocaleString("ja-JP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartData }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;

  return (
    <div className="rounded-xl border border-border/70 bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground">
        {label ? new Date(label).toLocaleDateString("ja-JP") : ""}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">
        {formatPrice(point.price, currency)}
      </p>
      <p className="mt-0.5 text-muted-foreground">
        出来高 {point.volume.toLocaleString("ja-JP")}
      </p>
    </div>
  );
}

export function StockChart({
  symbol,
  data,
  isLoading,
  currency = "$",
  onPeriodChange,
}: StockChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("1M");
  const hasData = !!data && data.length > 0;
  const chartData: ChartData[] = hasData ? data! : [];

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    onPeriodChange?.(period);
  };

  const stats = useMemo(() => {
    if (!hasData) return null;

    const prices = chartData.map(d => d.price);
    const firstPrice = chartData[0].price;
    const lastPrice = chartData[chartData.length - 1].price;
    const change = lastPrice - firstPrice;
    const changePercent = firstPrice !== 0 ? (change / firstPrice) * 100 : 0;
    const isUp = change >= 0;

    return {
      high: Math.max(...prices),
      low: Math.min(...prices),
      avgVolume: Math.round(
        chartData.reduce((sum, d) => sum + d.volume, 0) / chartData.length
      ),
      changePercent,
      isUp,
    };
  }, [chartData, hasData]);

  const chartColors = stats?.isUp
    ? {
        stroke: "hsl(142 71% 45%)",
        fillStart: "hsl(142 71% 45% / 0.28)",
        fillEnd: "hsl(142 71% 45% / 0.02)",
        badge: "text-emerald-600 dark:text-emerald-400",
      }
    : {
        stroke: "hsl(0 72% 51%)",
        fillStart: "hsl(0 72% 51% / 0.24)",
        fillEnd: "hsl(0 72% 51% / 0.02)",
        badge: "text-red-600 dark:text-red-400",
      };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            <span>{symbol} 株価チャート</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-8 w-14 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-2xl bg-muted/60" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            <span>{symbol} 株価チャート</span>
          </CardTitle>
          {stats && (
            <div
              className={`inline-flex items-center gap-1 rounded-full border border-border/70 px-2.5 py-1 text-xs font-medium ${chartColors.badge}`}
            >
              {stats.isUp ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              <span>
                {stats.changePercent >= 0 ? "+" : ""}
                {stats.changePercent.toFixed(2)}%
              </span>
              <span className="text-muted-foreground">
                （{PERIOD_LABELS[selectedPeriod] ?? selectedPeriod}）
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {onPeriodChange && (
          <ChartPeriodSelector
            selectedPeriod={selectedPeriod}
            onPeriodChange={handlePeriodChange}
          />
        )}
        {hasData && stats ? (
          <>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColors.fillStart} />
                      <stop offset="100%" stopColor={chartColors.fillEnd} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="4 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    minTickGap={24}
                    tickFormatter={value => {
                      try {
                        const date = new Date(value);
                        return date.toLocaleDateString("ja-JP", {
                          month: "short",
                          day: "numeric",
                        });
                      } catch {
                        return value;
                      }
                    }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={72}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    domain={["dataMin - 5", "dataMax + 5"]}
                    tickFormatter={value =>
                      value.toLocaleString("ja-JP", {
                        maximumFractionDigits: 0,
                      })
                    }
                  />
                  <Tooltip
                    content={<ChartTooltip currency={currency} />}
                    cursor={{
                      stroke: "hsl(var(--muted-foreground))",
                      strokeDasharray: "4 4",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={chartColors.stroke}
                    strokeWidth={2}
                    fill="url(#priceGradient)"
                    dot={false}
                    activeDot={{
                      r: 4,
                      stroke: chartColors.stroke,
                      strokeWidth: 2,
                      fill: "hsl(var(--background))",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border/70 pt-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">最高値</span>
                <p className="mt-1 font-semibold">
                  {formatPrice(stats.high, currency)}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">最安値</span>
                <p className="mt-1 font-semibold">
                  {formatPrice(stats.low, currency)}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">平均出来高</span>
                <p className="mt-1 font-semibold">
                  {stats.avgVolume.toLocaleString("ja-JP")}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div
            role="status"
            aria-live="polite"
            className="flex h-80 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-muted-foreground"
          >
            <BarChart3 className="h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">
              チャートデータを取得できませんでした
            </p>
            <p className="text-xs">時間をおいて再検索してください</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
