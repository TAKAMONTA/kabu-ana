"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Loader2 } from "lucide-react";
import type { WatchlistItem } from "@/hooks/useWatchlist";

interface WatchlistSectionProps {
  userLoggedIn: boolean;
  items: WatchlistItem[];
  loading: boolean;
  error: string | null;
  isPremium: boolean;
  freeLimit: number;
  onSelect: (symbol: string, displayText?: string) => void | Promise<void>;
  onRemove: (symbol: string) => void | Promise<void>;
}

export function WatchlistSection({
  userLoggedIn,
  items,
  loading,
  error,
  isPremium,
  freeLimit,
  onSelect,
  onRemove,
}: WatchlistSectionProps) {
  if (!userLoggedIn) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            マイウォッチリスト
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {isPremium ? `${items.length}銘柄` : `${items.length}/${freeLimit}銘柄`}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            ウォッチリストを読み込み中...
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            まだ銘柄がありません。検索した銘柄を右側パネルから追加できます。
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-md border p-2"
              >
                <button
                  type="button"
                  className="text-left flex-1 hover:opacity-80 transition-opacity"
                  onClick={() => onSelect(item.symbol, `${item.companyName} (${item.symbol})`)}
                >
                  <p className="text-sm font-medium line-clamp-1">{item.companyName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.symbol}
                    {item.market ? ` • ${item.market}` : ""}
                  </p>
                </button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRemove(item.symbol)}
                >
                  削除
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
