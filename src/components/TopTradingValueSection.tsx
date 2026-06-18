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
      return "border-primary/30 bg-primary/10 text-primary";
    case "medium":
      return "border-accent bg-accent text-accent-foreground";
    case "low":
      return "border-border bg-muted text-muted-foreground";
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
              : items.map(item => {
                  const displayName = normalizeDisplayText(item.name);
                  const attentionLabel = showAttentionScore
                    ? formatAttentionScore(item.confidence)
                    : "注目";
                  const sourceText = sourceSummary(item);

                  return (
                    <li
                      key={`${item.code}-${item.rank}`}
                      className="flex items-center justify-between gap-3 rounded-md border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">
                            {item.rank}. {displayName}
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
                          {normalizeDisplayText(item.reason)}
                        </p>
                        {sourceText && (
                          <p className="mt-1 truncate text-[11px] leading-4 text-muted-foreground">
                            情報源: {sourceText}
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
                      <div className="shrink-0 text-right text-xs">
                        <p
                          className={`rounded-full border px-2 py-1 font-medium ${attentionBadgeClassName(
                            item.confidence
                          )}`}
                        >
                          {attentionLabel}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSelect(item)}
                      >
                        分析
                      </Button>
                    </li>
                  );
                })}
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
