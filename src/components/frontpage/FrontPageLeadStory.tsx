"use client";

import { Button } from "@/components/ui/button";
import type { TradingValueItem } from "@/hooks/useTopTradingValue";
import {
  formatAttentionScore,
  getAttentionBadgeTone,
} from "@/lib/attentionScore";
import { normalizeDisplayText } from "@/lib/displayText";
import { BarChart3, ExternalLink } from "lucide-react";

interface FrontPageLeadStoryProps {
  idea?: TradingValueItem;
  isLoading: boolean;
  warning?: string | null;
  showAttentionScore?: boolean;
  onSelectIdea: (item: TradingValueItem) => void;
}

function attentionBadgeClassName(confidence: number): string {
  switch (getAttentionBadgeTone(confidence)) {
    case "high":
      return "border-primary/30 bg-primary/5 text-primary";
    case "medium":
      return "border-border bg-muted text-foreground";
    case "low":
      return "border-border bg-background text-muted-foreground";
  }
}

export function FrontPageLeadStory({
  idea,
  isLoading,
  warning,
  showAttentionScore = true,
  onSelectIdea,
}: FrontPageLeadStoryProps) {
  const ideaName = idea ? normalizeDisplayText(idea.name) : "";

  if (isLoading && !idea) {
    return (
      <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <div className="mb-4 h-5 w-24 shimmer rounded-full" />
        <div className="mb-3 h-7 w-3/4 shimmer rounded-lg" />
        <div className="h-4 w-full max-w-xl shimmer rounded" />
      </article>
    );
  }

  if (!idea) {
    return (
      <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
        <span className="inline-flex rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          注目材料
        </span>
        <h2 className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">
          企業名を確認できるニュース材料を待機中
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          ニュース内で銘柄名を確認できたものだけを注目材料として扱います。
          {warning ? ` ${warning}` : ""}
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          注目材料
        </span>
        {idea.code && (
          <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            {idea.code}
          </span>
        )}
        {idea.signalLabel && (
          <span className="rounded-full border border-emerald-500/20 bg-background px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {idea.signalLabel}
          </span>
        )}
      </div>

      <h2 className="mt-4 max-w-3xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
        今日の注目材料: {ideaName}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
        {normalizeDisplayText(idea.reason)}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => onSelectIdea(idea)}>
          <BarChart3 className="mr-2 h-4 w-4" />
          分析する
        </Button>
        {idea.sourceLinks?.[0] && (
          <a
            href={idea.sourceLinks[0]}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            根拠を見る
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${attentionBadgeClassName(
            idea.confidence
          )}`}
        >
          {showAttentionScore ? formatAttentionScore(idea.confidence) : "注目"}
        </span>
      </div>
    </article>
  );
}
