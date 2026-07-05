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
      label: "個別材料",
      value: isLoading
        ? "確認中"
        : topIdea
          ? normalizeDisplayText(topIdea.name)
          : "待機中",
      sub: topIdea?.code || topIdea?.signalLabel || "ニュース銘柄を抽出",
      dot: "bg-primary",
    },
    {
      icon: Radio,
      label: "外部環境",
      value: "Signals",
      sub: "原油・金利・地政学",
      href: "/signals",
      dot: "bg-sky-500",
    },
    {
      icon: Search,
      label: "分析枠",
      value: isPremium ? "Premium" : `${remainingUses}/${dailyLimit}`,
      sub: isPremium ? "AI分析利用中" : "本日の残り回数",
      dot: "bg-emerald-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map(item => {
        const cardClassName = `group h-full rounded-2xl border border-border/70 bg-background p-4 text-left transition-colors ${
          item.href ? "hover:border-foreground/20" : ""
        }`;
        const content = (
          <div className={cardClassName}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <item.icon className="h-4 w-4" />
                {item.label}
              </div>
              <span className={`h-2 w-2 rounded-full ${item.dot}`} aria-hidden />
            </div>
            <div className="truncate text-base font-bold tabular-nums text-foreground">
              {item.value}
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {item.sub}
            </div>
          </div>
        );

        return item.href ? (
          <Link key={item.label} href={item.href} className="block h-full">
            {content}
          </Link>
        ) : (
          <div key={item.label} className="h-full">
            {content}
          </div>
        );
      })}
    </div>
  );
}
