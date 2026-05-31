"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TradingValueItem } from "@/hooks/useTopTradingValue";

interface TopTradingValueSectionProps {
  items: TradingValueItem[];
  isLoading: boolean;
  error: string | null;
  warning?: string | null;
  onSelect: (symbol: string) => void;
}

export function TopTradingValueSection({
  items,
  isLoading,
  error,
  warning,
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
            <CardTitle className="text-base">注目の日本株（ニュース材料）</CardTitle>
            <span className="text-xs text-muted-foreground">
              {isLoading ? "更新中..." : "取得済み"}
            </span>
          </div>
          {error && !isLoading && (
            <p className="mt-2 text-xs text-red-600">
              データの取得に失敗しました: {error}
            </p>
          )}
          {!error && warning && !isLoading && (
            <p className="mt-2 text-xs text-muted-foreground">{warning}</p>
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
                    <div className="h-4 w-32 shimmer rounded" />
                    <div className="h-4 w-20 shimmer rounded" />
                    <div className="h-8 w-16 shimmer rounded" />
                  </li>
                ))
              : items.map(item => (
                  <li
                    key={`${item.code}-${item.rank}`}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">
                          {item.rank}. {item.name}
                        </p>
                        {item.code && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            {item.code}
                          </span>
                        )}
                        {item.signalLabel && (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                            {item.signalLabel}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.reason}
                      </p>
                      {item.sources.length > 0 && (
                        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                          情報源: {item.sources.join("、 ")}
                        </p>
                      )}
                      {item.sourceLinks && item.sourceLinks.length > 0 && (
                        <a
                          href={item.sourceLinks[0]}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-[11px] text-blue-600 hover:underline"
                        >
                          根拠を見る
                        </a>
                      )}
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
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
                企業名を確認できるニュース材料がまだありません。
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
