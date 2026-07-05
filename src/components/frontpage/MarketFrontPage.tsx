"use client";

import type { ReactNode } from "react";
import type { TradingValueItem } from "@/hooks/useTopTradingValue";
import { shouldShowAttentionScore } from "@/lib/attentionScore";
import { APP_NAME } from "@/lib/constants";
import { FrontPageLeadStory } from "./FrontPageLeadStory";
import { FrontPageMarketGrid } from "./FrontPageMarketGrid";

interface MarketFrontPageProps {
  searchSlot: ReactNode;
  pulseSlot: ReactNode;
  stockIdeasSlot: ReactNode;
  sampleSlot?: ReactNode;
  topIdea?: TradingValueItem;
  stockIdeas?: TradingValueItem[];
  isStockIdeasLoading: boolean;
  warning?: string | null;
  remainingUses: number;
  dailyLimit: number;
  isPremium: boolean;
  onSelectIdea: (item: TradingValueItem) => void;
}

function formatMarketDate() {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
}

export function MarketFrontPage({
  searchSlot,
  pulseSlot,
  stockIdeasSlot,
  sampleSlot,
  topIdea,
  stockIdeas = [],
  isStockIdeasLoading,
  warning,
  remainingUses,
  dailyLimit,
  isPremium,
  onSelectIdea,
}: MarketFrontPageProps) {
  const marketDate = formatMarketDate();
  const showAttentionScore = shouldShowAttentionScore(
    stockIdeas.map(item => item.confidence)
  );

  return (
    <div className="space-y-10">
      <section className="rounded-[2rem] border border-border/70 bg-card px-4 py-10 shadow-sm sm:px-6 lg:px-10 lg:py-12">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-5 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-background px-3 py-1 font-medium">
              {APP_NAME} market desk
            </span>
            <span>{marketDate}</span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            今日の市場一面
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            気になる企業を検索すると、株価・ニュース・AI分析をまとめて確認できます。
          </p>

          <div className="mx-auto mt-8 max-w-2xl">{searchSlot}</div>
          {sampleSlot && <div className="mx-auto mt-4 max-w-2xl">{sampleSlot}</div>}
        </div>

        <div className="mt-8">
          <FrontPageMarketGrid
            topIdea={topIdea}
            isLoading={isStockIdeasLoading}
            remainingUses={remainingUses}
            dailyLimit={dailyLimit}
            isPremium={isPremium}
          />
        </div>
      </section>

      <FrontPageLeadStory
        idea={topIdea}
        isLoading={isStockIdeasLoading}
        warning={warning}
        showAttentionScore={showAttentionScore}
        onSelectIdea={onSelectIdea}
      />

      {pulseSlot}
      {stockIdeasSlot}
    </div>
  );
}
