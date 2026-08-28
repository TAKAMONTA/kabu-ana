"use client";

import { Star, Trash2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import type { useWatchlist } from "@/hooks/useWatchlist";
import { useWatchlistQuotes } from "@/hooks/useWatchlistQuotes";
import { normalizeDisplayText } from "@/lib/displayText";
import { FREE_WATCHLIST_LIMIT } from "@/lib/watchlist/limits";

interface WatchlistSectionProps {
  watchlist: ReturnType<typeof useWatchlist>;
  onSelectCode: (code: string) => void;
  onRequestLogin: () => void;
}

const ASOF_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 2026-08-26 → 8月26日 */
function formatAsOf(asOf: string): string {
  if (!ASOF_PATTERN.test(asOf)) return "";
  const [, month, day] = asOf.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

export function WatchlistSection({
  watchlist,
  onSelectCode,
  onRequestLogin,
}: WatchlistSectionProps) {
  const { user } = useAuth();
  const { items, loading, error, limit, remove, clearError } = watchlist;
  const codes = items.map(item => item.code);
  const { quotes, failed, refresh } = useWatchlistQuotes(codes);

  if (!user) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            ログインすると、気になる銘柄を登録できます
          </p>
          <Button variant="outline" size="sm" onClick={onRequestLogin}>
            ログイン
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) return null;

  // 基準日は取得できたもののうち最も新しいものを代表として出す
  const asOfList = codes
    .map(code => quotes[code]?.asOf)
    .filter((value): value is string => Boolean(value))
    .sort();
  const latestAsOf = asOfList[asOfList.length - 1];
  const formattedAsOf = latestAsOf ? formatAsOf(latestAsOf) : "";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="w-4 h-4" />
            ウォッチリスト
            {Number.isFinite(limit) && (
              <span className="text-sm font-normal text-muted-foreground tabular-nums">
                {items.length} / {limit}
              </span>
            )}
          </CardTitle>
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              aria-label="株価を再取得"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
        {items.length > 0 && (
          <p className="text-xs text-muted-foreground">
            終値・前日比（J-Quants は当日16:30更新）
            {formattedAsOf ? ` ・ ${formattedAsOf} 終値` : ""}
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {error && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
            <div className="flex items-center justify-between gap-2">
              <span>{error}</span>
              <button
                type="button"
                onClick={clearError}
                className="text-xs underline"
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            検索して★を押すと、ここに並びます
            {Number.isFinite(limit) &&
              `（無料プランは${FREE_WATCHLIST_LIMIT}銘柄まで）`}
          </p>
        ) : (
          <ul className="divide-y">
            {items.map(item => {
              const quote = quotes[item.code];
              const isUp = (quote?.changePercent ?? 0) >= 0;
              const displayName = normalizeDisplayText(item.name);
              return (
                <li
                  key={item.code}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => onSelectCode(item.code)}
                    className="flex-1 text-left min-w-0"
                  >
                    <span className="block text-sm font-medium truncate">
                      {displayName}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {item.code}
                    </span>
                  </button>

                  <div className="text-right shrink-0">
                    {quote ? (
                      <>
                        <span className="block text-sm font-semibold tabular-nums">
                          {quote.close.toLocaleString()}
                        </span>
                        <span
                          className={`block text-xs tabular-nums ${
                            isUp
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {isUp ? "+" : ""}
                          {quote.changePercent.toFixed(2)}%
                        </span>
                      </>
                    ) : (
                      <span className="block text-sm text-muted-foreground">
                        —
                      </span>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`${displayName} を削除しますか？`)) {
                        void remove(item.code);
                      }
                    }}
                    aria-label={`${displayName} を削除`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {failed && items.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            株価を取得できませんでした。
            <button type="button" onClick={refresh} className="underline ml-1">
              再試行
            </button>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
