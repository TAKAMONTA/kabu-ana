"use client";

import Link from "next/link";
import type { TradingValueItem } from "@/hooks/useTopTradingValue";
import { normalizeDisplayText } from "@/lib/displayText";
import { Newspaper, Radio, Search } from "lucide-react";

interface FrontPageMarketGridProps {
  topIdea?: TradingValueItem;
  isLoading: boolean;
  remainingUses: number;
  dailyLimit: number;
  isPremium: boolean;
}

export function FrontPageMarketGrid({
  topIdea,
  isLoading,
  remainingUses,
  dailyLimit,
  isPremium,
}: FrontPageMarketGridProps) {
  const items = [
    {
      icon: Newspaper,
      label: "注目銘柄",
      value: isLoading
        ? "確認中"
        : topIdea
          ? `${normalizeDisplayText(topIdea.name)} ${topIdea.code}`
          : "まだありません",
      sub: topIdea?.signalLabel || "ニュースで話題の銘柄",
    },
    {
      icon: Radio,
      label: "市場全体",
      value: "マーケット・シグナル",
      sub: "原油・金利・世界情勢を見る",
      href: "/signals",
    },
    {
      icon: Search,
      label: "AI分析",
      value: isPremium ? "回数無制限" : `今日あと${remainingUses}回`,
      sub: isPremium
        ? "プレミアム利用中"
        : `無料プランは1日${dailyLimit}回まで`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
      {items.map(item => {
        const content = (
          <div className="rounded-md border bg-background/70 p-3 transition-colors hover:bg-muted/40">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase text-muted-foreground">
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </div>
            <div className="mt-2 truncate text-sm font-semibold">
              {item.value}
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {item.sub}
            </div>
          </div>
        );

        return item.href ? (
          <Link key={item.label} href={item.href} className="block">
            {content}
          </Link>
        ) : (
          <div key={item.label}>{content}</div>
        );
      })}
    </div>
  );
}
