"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Droplet, Flame, Radio } from "lucide-react";

interface PulseData {
  wti: { value: number | null; change24h: number | null } | null;
  hotCount: number;
  criticalCount: number;
}

async function fetchPulse(): Promise<PulseData> {
  const [pricesRes, newsRes] = await Promise.allSettled([
    fetch("/api/signals/prices", { cache: "no-store" }).then(r => r.json()),
    fetch("/api/signals/news", { cache: "no-store" }).then(r => r.json()),
  ]);

  const prices =
    pricesRes.status === "fulfilled"
      ? (pricesRes.value?.data?.prices ?? [])
      : [];
  const items =
    newsRes.status === "fulfilled" ? (newsRes.value?.data?.items ?? []) : [];

  const wti = prices.find((p: { key?: string }) => p?.key === "wti");
  const hotCount = items.filter(
    (i: { label?: string }) => i?.label === "Hot" || i?.label === "Critical"
  ).length;
  const criticalCount = items.filter(
    (i: { label?: string }) => i?.label === "Critical"
  ).length;

  return {
    wti: wti
      ? {
          value: typeof wti.value === "number" ? wti.value : null,
          change24h: typeof wti.change24h === "number" ? wti.change24h : null,
        }
      : null,
    hotCount,
    criticalCount,
  };
}

export function LivePulseStrip() {
  const [data, setData] = useState<PulseData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPulse()
      .then(d => {
        if (!cancelled) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const wtiValue = data?.wti?.value ?? null;
  const wtiChange = data?.wti?.change24h ?? null;
  const hot = data?.hotCount ?? 0;
  const critical = data?.criticalCount ?? 0;

  const cards = [
    {
      icon: Droplet,
      label: "WTI 原油",
      value:
        wtiValue != null ? `$${wtiValue.toFixed(2)}` : loaded ? "— —" : "...",
      sub:
        wtiChange != null
          ? `${wtiChange >= 0 ? "+" : ""}${wtiChange.toFixed(2)} (24h)`
          : "API キー未設定",
      tone:
        wtiChange != null && wtiChange < 0
          ? ("down" as const)
          : wtiChange != null
            ? ("up" as const)
            : ("neutral" as const),
      bg: "from-amber-500/15 to-orange-500/5 border-amber-400/40 dark:from-amber-500/20 dark:to-orange-500/5 dark:border-amber-500/30",
    },
    {
      icon: Radio,
      label: "マーケット・シグナル",
      value: loaded ? `${hot} 件` : "...",
      sub: hot > 0 ? "注目・緊急シグナルあり" : "現在は通常範囲",
      tone: "neutral" as const,
      bg: "from-sky-500/15 to-blue-500/5 border-sky-400/40 dark:from-sky-500/20 dark:to-blue-500/5 dark:border-sky-500/30",
    },
    {
      icon: Flame,
      label: "緊急アラート",
      value: loaded ? `${critical} 件` : "...",
      sub: critical > 0 ? "緊急シグナル発生中" : "現在 0 件",
      tone: critical > 0 ? ("alert" as const) : ("calm" as const),
      bg:
        critical > 0
          ? "from-red-500/20 to-rose-500/10 border-red-400/50 dark:from-red-500/25 dark:to-rose-500/10 dark:border-red-500/40"
          : "from-emerald-500/12 to-teal-500/5 border-emerald-400/30 dark:from-emerald-500/15 dark:to-teal-500/5 dark:border-emerald-500/25",
    },
  ];

  return (
    <Link
      href="/signals"
      aria-label="マーケット・シグナルを開く"
      className="group block mb-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
          >
            <Card
              className={`relative overflow-hidden border bg-gradient-to-br ${c.bg} transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg ${c.tone === "alert" ? "animate-pulse-soft" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <c.icon className="size-3.5" />
                    <span>{c.label}</span>
                  </div>
                  {i === cards.length - 1 && (
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  )}
                </div>
                <div className="text-2xl font-bold tracking-tight">
                  {c.value}
                </div>
                <div
                  className={`mt-1 text-xs ${
                    c.tone === "alert"
                      ? "text-red-700 dark:text-red-300 font-semibold"
                      : c.tone === "down"
                        ? "text-red-700 dark:text-red-300"
                        : c.tone === "up"
                          ? "text-emerald-700 dark:text-emerald-300"
                          : c.tone === "calm"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-muted-foreground"
                  }`}
                >
                  {c.sub}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </Link>
  );
}
