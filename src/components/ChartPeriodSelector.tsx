"use client";

import { Button } from "@/components/ui/button";

interface ChartPeriodSelectorProps {
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
}

const PERIODS = [
  { label: "1日", value: "1D" },
  { label: "5日", value: "5D" },
  { label: "1ヶ月", value: "1M" },
  { label: "6ヶ月", value: "6M" },
  { label: "1年", value: "1Y" },
  { label: "5年", value: "5Y" },
  { label: "全期間", value: "MAX" },
];

export function ChartPeriodSelector({
  selectedPeriod,
  onPeriodChange,
}: ChartPeriodSelectorProps) {
  return (
    // スマホ幅で「5年」「全期間」が画面外に切れて押せなかったため折り返す
    <div className="mb-4 flex flex-wrap gap-2">
      {PERIODS.map(period => (
        <Button
          key={period.value}
          variant={selectedPeriod === period.value ? "default" : "outline"}
          size="sm"
          className="h-9 px-3"
          aria-pressed={selectedPeriod === period.value}
          onClick={() => onPeriodChange(period.value)}
        >
          {period.label}
        </Button>
      ))}
    </div>
  );
}
