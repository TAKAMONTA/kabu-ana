"use client";

import { Button } from "@/components/ui/button";

interface ChartPeriodSelectorProps {
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  /**
   * 日本株のときは「1日」を出さない。J-Quants は日足のみで、1D を指定しても
   * 当日の値動き（分足）ではなく直近数日の日足になるため
   */
  isJapanStock?: boolean;
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
  isJapanStock = false,
}: ChartPeriodSelectorProps) {
  const periods = isJapanStock
    ? PERIODS.filter(period => period.value !== "1D")
    : PERIODS;
  // 米国株で「1日」を選んだまま日本株を開いた場合は、近い「5日」を選択中として見せる
  const activePeriod =
    isJapanStock && selectedPeriod === "1D" ? "5D" : selectedPeriod;

  return (
    // スマホ幅で「5年」「全期間」が画面外に切れて押せなかったため折り返す
    <div className="mb-4 flex flex-wrap gap-2">
      {periods.map(period => (
        <Button
          key={period.value}
          variant={activePeriod === period.value ? "default" : "outline"}
          size="sm"
          className="h-9 px-3"
          aria-pressed={activePeriod === period.value}
          onClick={() => onPeriodChange(period.value)}
        >
          {period.label}
        </Button>
      ))}
    </div>
  );
}
