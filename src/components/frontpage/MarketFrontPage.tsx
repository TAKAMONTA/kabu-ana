"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { TradingValueItem } from "@/hooks/useTopTradingValue";
import { shouldShowAttentionScore } from "@/lib/attentionScore";
import { APP_NAME } from "@/lib/constants";
import { FirstVisitGuide } from "./FirstVisitGuide";
import { FrontPageLeadStory } from "./FrontPageLeadStory";
import { FrontPageMarketGrid } from "./FrontPageMarketGrid";

interface MarketFrontPageProps {
  searchSlot: ReactNode;
  digestSlot?: ReactNode;
  watchlistSlot?: ReactNode;
  pulseSlot: ReactNode;
  stockIdeasSlot: ReactNode;
  sampleSlot?: ReactNode;
  topIdea?: TradingValueItem;
  stockIdeas?: TradingValueItem[];
  isStockIdeasLoading: boolean;
  warning?: string | null;
  stockIdeasError?: string | null;
  onRetryStockIdeas?: () => void;
  remainingUses: number;
  dailyLimit: number;
  isPremium: boolean;
  onSelectIdea: (item: TradingValueItem) => void;
}

const MARKET_DATE_FORMAT = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

function formatMarketDate() {
  return MARKET_DATE_FORMAT.format(new Date());
}

const subscribeNoop = () => () => {};

/**
 * 今日の日付（JST）。このページはビルド時にプリレンダーされるため、描画中に
 * new Date() を整形するとビルド日の日付が HTML に焼き込まれ、翌日以降は
 * hydration の不一致になる。サーバー（プリレンダー）では null を返し、
 * ブラウザでだけ日付を出す
 */
function useMarketDate(): string | null {
  return useSyncExternalStore(subscribeNoop, formatMarketDate, () => null);
}

export function MarketFrontPage({
  searchSlot,
  digestSlot,
  watchlistSlot,
  pulseSlot,
  stockIdeasSlot,
  sampleSlot,
  topIdea,
  stockIdeas = [],
  isStockIdeasLoading,
  warning,
  stockIdeasError,
  onRetryStockIdeas,
  remainingUses,
  dailyLimit,
  isPremium,
  onSelectIdea,
}: MarketFrontPageProps) {
  const marketDate = useMarketDate();
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
                <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground">
                  {APP_NAME}
                </p>
                <h2 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                  今日の市場一面
                </h2>
              </div>
              {/* 日付が出るまで高さが変わらないよう、空白で場所を確保する */}
              <p className="min-w-[9em] text-xs text-muted-foreground">
                {marketDate ?? "\u00a0"}
              </p>
            </div>

            {/* 初見でも迷わないよう、検索とサンプル銘柄を一面の最上部に置く */}
            <FirstVisitGuide />
            <div className="mt-4">{searchSlot}</div>
            {sampleSlot && <div className="mt-3">{sampleSlot}</div>}

            <div className="mt-5">
              <FrontPageLeadStory
                idea={topIdea}
                isLoading={isStockIdeasLoading}
                warning={warning}
                error={stockIdeasError}
                onRetry={onRetryStockIdeas}
                showAttentionScore={showAttentionScore}
                onSelectIdea={onSelectIdea}
              />
            </div>

            {digestSlot && <div className="mt-4">{digestSlot}</div>}
            {watchlistSlot && <div className="mt-4">{watchlistSlot}</div>}
          </div>

          <aside className="space-y-4">
            <FrontPageMarketGrid
              topIdea={topIdea}
              isLoading={isStockIdeasLoading}
              hasError={Boolean(stockIdeasError)}
              remainingUses={remainingUses}
              dailyLimit={dailyLimit}
              isPremium={isPremium}
            />
          </aside>
        </div>
      </section>

      {pulseSlot}
      {stockIdeasSlot}
    </div>
  );
}
