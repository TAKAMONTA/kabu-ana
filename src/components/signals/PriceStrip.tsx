"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePriceStrip } from "@/hooks/signals/usePriceStrip";
import { PanelError, PanelLoading, formatRelativeTime } from "./PanelState";

/** 指標名・単位を初心者向けの日本語にする（未知のものはそのまま出す） */
const LABEL_JA: Record<string, string> = {
  wti: "WTI原油",
  brent: "ブレント原油",
  natGas: "天然ガス（米国）",
  vix: "VIX（恐怖指数）",
};

const UNIT_JA: Record<string, string> = {
  "USD/bbl": "ドル/バレル",
  "USD/MMBtu": "ドル/百万BTU",
  Mbbl: "千バレル",
  pt: "",
};

export function PriceStrip() {
  const { data, error, isLoading, lastSuccessfulAt, refresh } = usePriceStrip();
  const prices = data?.prices ?? [];

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          原油・金利などの主要指標
          <span className="text-xs font-normal text-muted-foreground">最終更新: {formatRelativeTime(data?.fetchedAt ?? lastSuccessfulAt)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <PanelLoading rows={2} /> : error && !data ? <PanelError error={error} onRetry={refresh} /> : prices.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            価格データはまだありません。時間をおいて再度ご確認ください。
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {prices.map((price) => {
              const change = price.change24h;
              const positive = (change ?? 0) >= 0;
              const hasChange = change != null;
              return (
                <div
                  key={price.key}
                  className={`rounded-lg border bg-card p-4 border-l-4 ${hasChange && positive ? "border-l-emerald-500" : hasChange ? "border-l-red-500" : "border-l-border"}`}
                >
                  <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-3">
                    {LABEL_JA[price.key] ?? price.label}
                  </p>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-3xl font-bold tracking-tight tabular-nums">
                      {price.value == null ? "—" : price.value.toFixed(price.value > 1000 ? 0 : 2)}
                    </span>
                    {price.unit && (UNIT_JA[price.unit] ?? price.unit) && (
                      <span className="text-xs text-muted-foreground">{UNIT_JA[price.unit] ?? price.unit}</span>
                    )}
                  </div>
                  {hasChange ? (
                    <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${positive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"}`}>
                      {positive ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                      {positive ? "+" : ""}{change.toFixed(2)}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">前日比データなし</span>
                  )}
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
