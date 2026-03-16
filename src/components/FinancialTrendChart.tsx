"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { FinancialHistoryItem } from "@/hooks/useCompanySearch";

interface FinancialTrendChartProps {
  financialHistory: FinancialHistoryItem[];
  companyName: string;
}

type ViewMode = "pl" | "cf";

function formatBillions(value: number | undefined): string {
  if (value == null) return "N/A";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)}兆`;
  if (abs >= 1e8) return `${(value / 1e8).toFixed(0)}億`;
  if (abs >= 1e4) return `${(value / 1e4).toFixed(0)}万`;
  return value.toLocaleString();
}

// Recharts の tooltip formatter
const tooltipFormatter = (value: number, name: string) => {
  return [formatBillions(value), name];
};

const yAxisFormatter = (value: number) => {
  if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(0)}兆`;
  if (Math.abs(value) >= 1e8) return `${(value / 1e8).toFixed(0)}億`;
  if (Math.abs(value) >= 1e4) return `${(value / 1e4).toFixed(0)}万`;
  return String(value);
};

export function FinancialTrendChart({ financialHistory, companyName }: FinancialTrendChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("pl");

  if (!financialHistory || financialHistory.length === 0) return null;

  const chartData = financialHistory.map(h => ({
    year: `FY${h.fiscalYear}`,
    売上高: h.revenue,
    営業利益: h.operatingIncome,
    純利益: h.netIncome,
    営業CF: h.cfOperating,
    総資産: h.totalAssets,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              財務推移
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              出典: EDINET DB（直近{financialHistory.length}年）
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode("pl")}
              className={`px-2 py-1 text-xs rounded border transition-colors ${
                viewMode === "pl"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              PL
            </button>
            <button
              onClick={() => setViewMode("cf")}
              className={`px-2 py-1 text-xs rounded border transition-colors ${
                viewMode === "cf"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              CF
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {viewMode === "pl" ? (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
              />
              <YAxis
                tickFormatter={yAxisFormatter}
                tick={{ fontSize: 10 }}
                className="fill-muted-foreground"
                width={50}
              />
              <Tooltip
                formatter={tooltipFormatter}
                contentStyle={{ fontSize: 12 }}
                labelStyle={{ fontWeight: "bold" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="売上高" fill="hsl(210 40% 60%)" radius={[2, 2, 0, 0]} />
              <Line
                type="monotone"
                dataKey="営業利益"
                stroke="hsl(142 71% 45%)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="純利益"
                stroke="hsl(24 100% 55%)"
                strokeWidth={2}
                dot={{ r: 3 }}
                strokeDasharray="5 3"
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
              />
              <YAxis
                tickFormatter={yAxisFormatter}
                tick={{ fontSize: 10 }}
                className="fill-muted-foreground"
                width={50}
              />
              <Tooltip
                formatter={tooltipFormatter}
                contentStyle={{ fontSize: 12 }}
                labelStyle={{ fontWeight: "bold" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="営業CF" fill="hsl(262 80% 60%)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
