"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3 } from "lucide-react";
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
    if (onPeriodChange) {
      onPeriodChange(period);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>{symbol} 株価チャート</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5" />
          <span>{symbol} 株価チャート</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 期間選択 */}
        {onPeriodChange && (
          <ChartPeriodSelector
            selectedPeriod={selectedPeriod}
            onPeriodChange={handlePeriodChange}
          />
        )}
        {hasData ? (
          <>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="date"
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
                    domain={["dataMin - 5", "dataMax + 5"]}
                    tickFormatter={value => `${currency}${value}`}
                  />
                  <Tooltip
                    labelFormatter={value =>
                      new Date(value).toLocaleDateString("ja-JP")
                    }
                    formatter={(value: number, name: string) => [
                      name === "price"
                        ? `${currency}${value}`
                        : value.toLocaleString(),
                      name === "price" ? "価格" : "出来高",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* チャート統計 */}
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">最高値</span>
                <p className="font-semibold">
                  {currency}
                  {Math.max(...chartData.map(d => d.price)).toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">最安値</span>
                <p className="font-semibold">
                  {currency}
                  {Math.min(...chartData.map(d => d.price)).toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">平均出来高</span>
                <p className="font-semibold">
                  {Math.round(
                    chartData.reduce((sum, d) => sum + d.volume, 0) /
                      chartData.length
                  ).toLocaleString()}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div
            role="status"
            aria-live="polite"
            className="flex h-80 flex-col items-center justify-center gap-2 rounded-md border border-dashed text-muted-foreground"
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
