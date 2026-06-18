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
    <div className="space-y-6">
      <section className="border-y border-border bg-card/55">
        <div className="grid gap-6 py-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)]">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                  {APP_NAME} market desk
                </p>
                <h2 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                  今日の市場一面
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">{marketDate}</p>
            </div>

            <FrontPageLeadStory
              idea={topIdea}
              isLoading={isStockIdeasLoading}
              warning={warning}
              showAttentionScore={showAttentionScore}
              onSelectIdea={onSelectIdea}
            />

            <div className="mt-5">{searchSlot}</div>
          </div>

          <aside className="space-y-4">
            <FrontPageMarketGrid
              topIdea={topIdea}
              isLoading={isStockIdeasLoading}
              remainingUses={remainingUses}
              dailyLimit={dailyLimit}
              isPremium={isPremium}
            />
            {sampleSlot}
          </aside>
        </div>
      </section>

      {pulseSlot}
      {stockIdeasSlot}
    </div>
  );
}
