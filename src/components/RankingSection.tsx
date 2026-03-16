"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart2, Loader2, AlertCircle } from "lucide-react";
import { useRanking, RANKING_METRICS, RankingMetric } from "@/hooks/useRanking";

interface RankingSectionProps {
  onSelect: (query: string) => void;
}

// ランキング API の value は既に % 単位で返ってくる（unit: "%" フィールドで確認済み）
function formatValue(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function RankingSection({ onSelect }: RankingSectionProps) {
  const [selectedMetric, setSelectedMetric] = useState<RankingMetric>("roe");
  const { items, isLoading, error } = useRanking(selectedMetric, 10);

  const handleSelect = (item: { name: string; sec_code?: string }) => {
    if (item.sec_code) {
      // 5桁コード（例: 72030）から4桁の証券コード（7203）を抽出して検索
      const digits = item.sec_code.replace(/\D/g, "");
      const code = digits.length >= 5 ? digits.slice(0, 4) : digits;
      onSelect(code || item.name);
    } else {
      onSelect(item.name);
    }
  };

  const currentLabel = RANKING_METRICS.find(m => m.value === selectedMetric)?.label ?? selectedMetric;

  return (
    <div className="mb-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" />
              財務指標ランキング（EDINET DB）
            </CardTitle>
            {isLoading && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                取得中...
              </span>
            )}
          </div>

          {/* 指標切り替えタブ */}
          <div className="flex flex-wrap gap-1 mt-2">
            {RANKING_METRICS.map(m => (
              <button
                key={m.value}
                onClick={() => setSelectedMetric(m.value)}
                className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                  selectedMetric === m.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {error ? (
            <div className="flex items-center gap-2 text-sm text-destructive py-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <ul className="space-y-2">
              {isLoading && items.length === 0
                ? Array.from({ length: 5 }).map((_, i) => (
                    <li key={i} className="flex items-center justify-between rounded-md border p-2 animate-pulse">
                      <div className="h-4 bg-muted rounded w-40" />
                      <div className="h-4 bg-muted rounded w-16" />
                    </li>
                  ))
                : items.map((item, index) => (
                    <li
                      key={`${item.edinet_code}-${index}`}
                      className="flex items-center justify-between rounded-md border p-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          <span className="text-muted-foreground mr-1.5">{index + 1}.</span>
                          {item.name}
                        </p>
                        {(item.sec_code || item.industry) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.sec_code && <span>{item.sec_code}</span>}
                            {item.sec_code && item.industry && <span className="mx-1">／</span>}
                            {item.industry && <span>{item.industry}</span>}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-primary">
                          {formatValue(item.value)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleSelect(item)}
                        >
                          分析
                        </Button>
                      </div>
                    </li>
                  ))}
            </ul>
          )}

          {!isLoading && !error && items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              ランキングデータがありません
            </p>
          )}

          <p className="text-xs text-muted-foreground mt-3 text-right">
            出典: EDINET DB
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
