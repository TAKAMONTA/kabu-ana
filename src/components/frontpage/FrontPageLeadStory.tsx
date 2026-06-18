"use client";

import { Button } from "@/components/ui/button";
import type { TradingValueItem } from "@/hooks/useTopTradingValue";
import { formatAttentionScore, getAttentionBadgeTone } from "@/lib/attentionScore";
import { normalizeDisplayText } from "@/lib/displayText";
import { BarChart3, ExternalLink } from "lucide-react";

interface FrontPageLeadStoryProps {
  idea?: TradingValueItem;
  isLoading: boolean;
  warning?: string | null;
  onSelectIdea: (item: TradingValueItem) => void;
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

export function FrontPageLeadStory({
  idea,
  isLoading,
  warning,
  onSelectIdea,
}: FrontPageLeadStoryProps) {
  const ideaName = idea ? normalizeDisplayText(idea.name) : "";

  if (isLoading && !idea) {
    return (
      <article className="border-y border-border py-5">
        <div className="mb-3 h-4 w-28 shimmer rounded" />
        <div className="mb-3 h-8 w-3/4 shimmer rounded" />
        <div className="h-4 w-full max-w-xl shimmer rounded" />
      </article>
    );
  }

  if (!idea) {
    return (
      <article className="border-y border-border py-5">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Market Lead
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">
          企業名を確認できるニュース材料を待機中
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          ニュース内で銘柄名を確認できたものだけを注目材料として扱います。
          {warning ? ` ${warning}` : ""}
        </p>
      </article>
    );
  }

  return (
    <article className="border-y border-border py-5">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold uppercase">Market Lead</span>
        <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
        <span>{idea.code}</span>
        {idea.signalLabel && (
          <span className="rounded bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {idea.signalLabel}
          </span>
        )}
      </div>
      <h2 className="max-w-3xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
        今日の注目材料: {ideaName}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        {normalizeDisplayText(idea.reason)}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => onSelectIdea(idea)}>
          <BarChart3 className="mr-2 h-4 w-4" />
          この銘柄を分析
        </Button>
        {idea.sourceLinks?.[0] && (
          <a
            href={idea.sourceLinks[0]}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
          >
            根拠を見る
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <span
          className={`rounded-full border px-2 py-1 text-xs font-medium ${attentionBadgeClassName(
            idea.confidence
          )}`}
        >
          {formatAttentionScore(idea.confidence)}
        </span>
      </div>
    </article>
  );
}
