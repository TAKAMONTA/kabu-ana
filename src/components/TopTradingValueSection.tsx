"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TradingValueItem } from "@/hooks/useTopTradingValue";

interface TopTradingValueSectionProps {
  items: TradingValueItem[];
  isLoading: boolean;
  error: string | null;
  onSelect: (symbol: string) => void;
}

export function TopTradingValueSection({
  items,
  isLoading,
  error,
  onSelect,
}: TopTradingValueSectionProps) {
  const handleSelect = (item: TradingValueItem) => {
    if (!item) return;
    const symbol =
      item.code && /^\d{4}$/.test(item.code) ? `${item.code}:TYO` : item.code;
    onSelect(symbol || item.name);
  };

  return (
    <div className="mb-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              今日の注目銘柄（TOP5）
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {isLoading ? "更新中..." : "取得済み"}
            </span>
          </div>
          {error && !isLoading && (
            <p className="mt-2 text-xs text-red-600">
              データの取得に失敗しました: {error}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {isLoading && items.length === 0
              ? Array.from({ length: 5 }).map((_, index) => (
                  <li
                    key={`skeleton-${index}`}
                    className="flex items-center justify-between rounded-md border p-2"
                  >
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                  </li>
                ))
              : items.map(item => (
                  <li
                    key={`${item.code}-${item.rank}`}
                    className="flex items-center justify-between rounded-md border p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {item.rank}. {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.code && <span>{item.code} ／ </span>}
                        {item.reason}
                      </p>
                      {item.sources.length > 0 && (
                        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                          情報源: {item.sources.join("、 ")}
                        </p>
                      )}
                    </div>
                    <div className="mr-3 text-right text-xs text-muted-foreground">
                      <p>注目度: {(item.confidence * 100).toFixed(0)}%</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelect(item)}
                    >
                      分析
                    </Button>
                  </li>
                ))}
            {!isLoading && items.length === 0 && !error && (
              <li className="rounded-md border p-4 text-center text-sm text-muted-foreground">
                現在表示できるデータがありません。
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

