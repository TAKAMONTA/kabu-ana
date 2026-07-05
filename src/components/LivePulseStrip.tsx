"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Droplet, Flame, Radio } from "lucide-react";
import { fetchSignal } from "@/hooks/signals/useSignalApi";
import {
  derivePulse,
  type PulseData,
  type PulseNewsItem,
  type PulsePricePoint,
} from "@/lib/signals/derivePulse";

async function fetchPulse(): Promise<PulseData> {
  const [pricesRes, newsRes] = await Promise.allSettled([
    fetchSignal<{ prices: PulsePricePoint[] }>("/api/signals/prices"),
    fetchSignal<{ items: PulseNewsItem[] }>("/api/signals/news"),
  ]);

  const prices =
    pricesRes.status === "fulfilled"
      ? (pricesRes.value.data?.prices ?? [])
      : [];
  const items =
    newsRes.status === "fulfilled" ? (newsRes.value.data?.items ?? []) : [];

  return derivePulse(prices, items);
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
          : "データ未取得",
      tone:
        wtiChange != null && wtiChange < 0
          ? ("down" as const)
          : wtiChange != null
            ? ("up" as const)
            : ("neutral" as const),
      dot: "bg-amber-500",
    },
    {
      icon: Radio,
      label: "マーケット・シグナル",
      value: loaded ? `${hot} 件` : "...",
      sub: hot > 0 ? "注目シグナルあり" : "通常範囲",
      tone: "neutral" as const,
      dot: "bg-sky-500",
    },
    {
      icon: Flame,
      label: "緊急アラート",
      value: loaded ? `${critical} 件` : "...",
      sub: critical > 0 ? "緊急シグナル発生中" : "現在 0 件",
      tone: critical > 0 ? ("alert" as const) : ("calm" as const),
      dot: critical > 0 ? "bg-red-500" : "bg-emerald-500",
    },
  ];

  return (
    <Link
      href="/signals"
      aria-label="マーケット・シグナルを開く"
      className="group block"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.06, ease: "easeOut" }}
          >
            <Card
              className={`relative overflow-hidden border-border/70 py-0 shadow-sm transition-colors duration-300 group-hover:border-foreground/20 ${
                c.tone === "alert" ? "animate-pulse-soft" : ""
              }`}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <c.icon className="size-4" />
                    <span>{c.label}</span>
                  </div>
                  <span className={`size-2 rounded-full ${c.dot}`} aria-hidden />
                </div>
                <div className="mb-2 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
                  {c.value}
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{c.sub}</span>
                  {i === cards.length - 1 && (
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </Link>
  );
}
