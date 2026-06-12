"use client";

import Link from "next/link";
import type { TradingValueItem } from "@/hooks/useTopTradingValue";
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
          ? `${topIdea.name} ${topIdea.code}`
          : "待機中",
      sub: topIdea?.signalLabel || "ニュース銘柄を抽出",
    },
    {
      icon: Radio,
      label: "外部環境",
      value: "Signals",
      sub: "原油・金利・地政学",
      href: "/signals",
    },
    {
      icon: Search,
      label: "分析枠",
      value: isPremium ? "Premium" : `${remainingUses}/${dailyLimit}`,
      sub: isPremium ? "AI分析利用中" : "本日の残り回数",
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
