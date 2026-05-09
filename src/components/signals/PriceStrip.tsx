"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePriceStrip } from "@/hooks/signals/usePriceStrip";
import { PanelError, PanelLoading, formatRelativeTime } from "./PanelState";

export function PriceStrip() {
  const { data, error, isLoading, lastSuccessfulAt, refresh } = usePriceStrip();
  const prices = data?.prices ?? [];

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          市場価格ストリップ
          <span className="text-xs font-normal text-muted-foreground">最終更新: {formatRelativeTime(data?.fetchedAt ?? lastSuccessfulAt)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <PanelLoading rows={2} /> : error && !data ? <PanelError error={error} onRetry={refresh} /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {prices.map((price) => {
              const change = price.change24h;
              const positive = (change ?? 0) >= 0;
              return (
                <div key={price.key} className="rounded-md border bg-background p-3">
                  <div className="text-xs text-muted-foreground">{price.label}</div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-xl font-semibold">{price.value == null ? "--" : price.value.toFixed(price.value > 1000 ? 0 : 2)}</span>
                    <span className="text-[10px] text-muted-foreground">{price.unit}</span>
                  </div>
                  <div className={`mt-2 flex items-center gap-1 text-xs ${positive ? "text-green-700" : "text-red-700"}`}>
                    {positive ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                    {change == null ? "変化なし" : change.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {error && data && <div className="mt-3"><PanelError error={error} onRetry={refresh} /></div>}
      </CardContent>
    </Card>
  );
}
