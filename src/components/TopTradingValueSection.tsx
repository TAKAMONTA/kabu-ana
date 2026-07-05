"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TradingValueItem } from "@/hooks/useTopTradingValue";
import {
  formatAttentionScore,
  getAttentionBadgeTone,
  shouldShowAttentionScore,
} from "@/lib/attentionScore";
import { normalizeDisplayText } from "@/lib/displayText";

interface TopTradingValueSectionProps {
  items: TradingValueItem[];
  isLoading: boolean;
  error: string | null;
  warning?: string | null;
  onSelect: (symbol: string) => void;
}

function attentionBadgeClassName(confidence: number): string {
  switch (getAttentionBadgeTone(confidence)) {
    case "high":
      return "border-primary/30 text-primary";
    case "medium":
      return "border-border text-foreground";
    case "low":
      return "border-border text-muted-foreground";
  }
}

function sourceHost(sourceLink?: string): string {
  if (!sourceLink) return "";

  try {
    return new URL(sourceLink).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sourceSummary(item: TradingValueItem): string {
  const duplicateCandidates = new Set(
    [item.evidence, item.reason].map(value => normalizeDisplayText(value || ""))
  );
  const sources = item.sources
    .map(normalizeDisplayText)
    .filter(source => source && !duplicateCandidates.has(source));

  if (sources.length > 0) return Array.from(new Set(sources)).join("、 ");

  return sourceHost(item.sourceLinks?.[0]);
}

export function TopTradingValueSection({
  items,
  isLoading,
  error,
  warning,
  onSelect,
}: TopTradingValueSectionProps) {
  const showAttentionScore = shouldShowAttentionScore(
    items.map(item => item.confidence)
  );

  const handleSelect = (item: TradingValueItem) => {
    if (!item) return;
    const symbol =
      item.code && /^\d{4}$/.test(item.code) ? `${item.code}:TYO` : item.code;
    onSelect(symbol || item.name);
  };

  return (
    <div>
      <Card className="border-border/70 py-0 shadow-sm">
        <CardHeader className="px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold tracking-tight">
                注目のアイデア
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                ニュース材料から抽出した日本株候補
              </p>
            </div>
            <span className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
              {isLoading ? "更新中" : "取得済み"}
            </span>
          </div>
          {error && !isLoading && (
            <p className="mt-3 text-xs text-red-600">
              データの取得に失敗しました: {error}
            </p>
          )}
          {!error && warning && !isLoading && (
            <p className="mt-3 text-xs text-muted-foreground">{warning}</p>
          )}
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <ul className="divide-y divide-border/70">
            {isLoading && items.length === 0
              ? Array.from({ length: 5 }).map((_, index) => (
                  <li
                    key={`skeleton-${index}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-40 shimmer rounded" />
                      <div className="h-3 w-3/4 shimmer rounded" />
                    </div>
                    <div className="h-8 w-16 shimmer rounded-full" />
                  </li>
                ))
              : items.map(item => {
                  const displayName = normalizeDisplayText(item.name);
                  const attentionLabel = showAttentionScore
                    ? formatAttentionScore(item.confidence)
                    : "注目";
                  const sourceText = sourceSummary(item);

                  return (
                    <li
                      key={`${item.code}-${item.rank}`}
                      className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex size-7 items-center justify-center rounded-full border border-border/70 bg-background text-xs font-bold tabular-nums text-muted-foreground">
                            {item.rank}
                          </span>
                          {item.code && (
                            <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
                              {item.code}
                            </span>
                          )}
                          <p className="truncate text-sm font-bold">
                            {displayName}
                          </p>
                          {item.signalLabel && (
                            <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground">
                              {item.signalLabel}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {normalizeDisplayText(item.reason)}
                        </p>
                        {sourceText && (
                          <p className="mt-1 truncate text-[11px] leading-4 text-muted-foreground">
                            情報源: {sourceText}
                            {item.sourceLinks?.[0] && (
                              <a
                                href={item.sourceLinks[0]}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-2 font-medium text-foreground underline-offset-4 hover:underline"
                              >
                                根拠を見る
                              </a>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${attentionBadgeClassName(
                            item.confidence
                          )}`}
                        >
                          {attentionLabel}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelect(item)}
                          className="rounded-full"
                        >
                          分析
                        </Button>
                      </div>
                    </li>
                  );
                })}
            {!isLoading && items.length === 0 && !error && (
              <li className="px-5 py-8 text-center text-sm text-muted-foreground sm:px-6">
                企業名を確認できるニュース材料がまだありません。
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
