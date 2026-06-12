"use client";

import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEnergyNews } from "@/hooks/signals/useEnergyNews";
import {
  getScoreLabelJa,
  getSignalLabelJa,
  localizeSignalKeywords,
} from "@/lib/signals/localize";
import { PanelError, PanelLoading, formatRelativeTime } from "./PanelState";

export function EnergyNewsBoard() {
  const { data, error, isLoading, lastSuccessfulAt, refresh } = useEnergyNews();
  const items = data?.items ?? [];

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          エネルギー・地政学ニュース
          <span className="text-xs font-normal text-muted-foreground">最終更新: {formatRelativeTime(data?.fetchedAt ?? lastSuccessfulAt)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <PanelLoading rows={5} /> : error && !data ? <PanelError error={error} onRetry={refresh} /> : (
          <div className="space-y-3">
            {items.slice(0, 12).map((item) => (
              <a key={item.id} href={item.link} target="_blank" rel="noreferrer" className="block rounded-md border bg-background p-3 transition-colors hover:bg-accent">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{item.source}</span>
                  {item.label !== "Normal" && (
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${item.label === "Critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {getSignalLabelJa(item.label)}
                    </span>
                  )}
                  <span className="rounded bg-muted px-2 py-0.5 text-[10px]">{getScoreLabelJa(item.score)}</span>
                  <ExternalLink className="ml-auto size-3 text-muted-foreground" />
                </div>
                <div className="mt-2 text-sm font-medium leading-snug">
                  {item.titleJa || item.title}
                </div>
                {item.titleJa && item.titleJa !== item.title && (
                  <div className="mt-1 text-xs leading-snug text-muted-foreground">
                    {item.titleJa.startsWith("原文確認:")
                      ? "未翻訳の原文"
                      : "原文"}
                    : {item.title}
                  </div>
                )}
                {item.matchedKeywords.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {localizeSignalKeywords(item.matchedKeywords).slice(0, 5).map((keyword) => (
                      <span key={keyword} className="rounded bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">{keyword}</span>
                    ))}
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
        {error && data && <div className="mt-3"><PanelError error={error} onRetry={refresh} /></div>}
      </CardContent>
    </Card>
  );
}
