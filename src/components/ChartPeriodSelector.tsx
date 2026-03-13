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
    <div className="flex space-x-2 mb-4">
      {PERIODS.map(period => (
        <Button
          key={period.value}
          variant={selectedPeriod === period.value ? "default" : "outline"}
          size="sm"
          onClick={() => onPeriodChange(period.value)}
        >
          {period.label}
        </Button>
      ))}
    </div>
  );
}
