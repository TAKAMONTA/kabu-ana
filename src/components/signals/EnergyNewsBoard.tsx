"use client";

import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEnergyNews } from "@/hooks/signals/useEnergyNews";
import {
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
          <div className="space-y-2">
            {items.slice(0, 12).map((item) => {
              const isCritical = item.label === "Critical";
              const isHot = item.label === "Hot";
              const borderColor = isCritical
                ? "border-l-red-500"
                : isHot
                  ? "border-l-amber-500"
                  : "border-l-border";
              return (
                <a
                  key={item.id}
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className={`block rounded-lg border bg-card border-l-4 ${borderColor} px-4 py-3 transition-colors hover:bg-accent`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {isCritical && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-950 dark:text-red-300">
                        {getSignalLabelJa(item.label)}
                      </span>
                    )}
                    {isHot && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {getSignalLabelJa(item.label)}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">{item.source}</span>
                    <ExternalLink className="ml-auto size-3 shrink-0 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-semibold leading-snug text-foreground">
                    {item.titleJa || item.title}
                  </p>
                  {item.matchedKeywords.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {localizeSignalKeywords(item.matchedKeywords).slice(0, 3).map((keyword) => (
                        <span key={keyword} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{keyword}</span>
                      ))}
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        )}
        {error && data && <div className="mt-3"><PanelError error={error} onRetry={refresh} /></div>}
      </CardContent>
    </Card>
  );
}
