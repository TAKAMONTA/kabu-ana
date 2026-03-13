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
import { TrendingUp } from "lucide-react";
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

// サンプルデータ（実際のAPIから取得するデータに置き換え）
const generateSampleData = (): ChartData[] => {
  const data: ChartData[] = [];
  const basePrice = 100 + Math.random() * 50;
  let currentPrice = basePrice;

  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    // ランダムな価格変動
    const change = (Math.random() - 0.5) * 5;
    currentPrice = Math.max(50, currentPrice + change);

    data.push({
      date: date.toISOString().split("T")[0],
      price: Math.round(currentPrice * 100) / 100,
      volume: Math.floor(Math.random() * 1000000) + 100000,
    });
  }

  return data;
};

export function StockChart({
  symbol,
  data,
  isLoading,
  currency = "$",
  onPeriodChange,
}: StockChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("1M");
  const chartData = data && data.length > 0 ? data : generateSampleData();

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
      </CardContent>
    </Card>
  );
}
