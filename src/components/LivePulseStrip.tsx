"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Droplet, Flame, Radio } from "lucide-react";
import { fetchSignal } from "@/hooks/signals/useSignalApi";
import {
  derivePulse,
  type PulseData,
  type PulseNewsItem,
  type PulsePricePoint,
} from "@/lib/signals/derivePulse";

interface PulseResult {
  data: PulseData;
  /** 価格（WTI）を取得できたか */
  pricesOk: boolean;
  /** ニュース（シグナル件数の元）を取得できたか */
  newsOk: boolean;
}

async function fetchPulse(): Promise<PulseResult> {
  const [pricesRes, newsRes] = await Promise.allSettled([
    fetchSignal<{ prices: PulsePricePoint[] }>("/api/signals/prices"),
    fetchSignal<{ items: PulseNewsItem[] }>("/api/signals/news"),
  ]);

  // 取得失敗を「0件」として扱うと「現在は通常範囲」「緊急 0 件」と
  // 問題なしに見えてしまうため、取得できたかどうかを別に持つ
  const prices =
    pricesRes.status === "fulfilled" &&
    Array.isArray(pricesRes.value?.data?.prices)
      ? pricesRes.value.data.prices
      : null;
  // 0件でもエラー付き（取得失敗して空を返した）なら取得できなかった扱いにする
  const items =
    newsRes.status === "fulfilled" &&
    Array.isArray(newsRes.value?.data?.items) &&
    !(newsRes.value.data.items.length === 0 && newsRes.value.error)
      ? newsRes.value.data.items
      : null;

  return {
    data: derivePulse(prices ?? [], items ?? []),
    pricesOk: prices !== null,
    newsOk: items !== null,
  };
}

type Tone = "up" | "down" | "alert" | "calm" | "neutral";

const UNAVAILABLE = "取得できませんでした";

export function LivePulseStrip() {
  const [result, setResult] = useState<PulseResult | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPulse()
      .then(d => {
        if (!cancelled) setResult(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const data = result?.data ?? null;
  const pricesOk = result?.pricesOk ?? false;
  const newsOk = result?.newsOk ?? false;
  const wtiValue = data?.wti?.value ?? null;
  const wtiChange = data?.wti?.change24h ?? null;
  const hot = data?.hotCount ?? 0;
  const critical = data?.criticalCount ?? 0;

  const cards: Array<{
    icon: typeof Droplet;
    label: string;
    value: string;
    sub: string;
    tone: Tone;
    bg: string;
  }> = [
    {
      icon: Droplet,
      label: "WTI 原油",
      value: wtiValue != null ? `$${wtiValue.toFixed(2)}` : loaded ? "—" : "…",
      sub: !loaded
        ? "読み込み中…"
        : wtiChange != null
          ? `24時間で ${wtiChange >= 0 ? "+" : ""}${wtiChange.toFixed(2)}ドル`
          : pricesOk
            ? "前日比データなし"
            : UNAVAILABLE,
      tone:
        wtiChange != null && wtiChange < 0
          ? "down"
          : wtiChange != null
            ? "up"
            : "neutral",
      bg: "from-amber-500/15 to-orange-500/5 border-amber-400/40 dark:from-amber-500/20 dark:to-orange-500/5 dark:border-amber-500/30",
    },
    {
      icon: Radio,
      label: "マーケット・シグナル",
      value: !loaded ? "…" : newsOk ? `${hot} 件` : "—",
      sub: !loaded
        ? "読み込み中…"
        : !newsOk
          ? UNAVAILABLE
          : hot > 0
            ? "注目・緊急シグナルあり"
            : "現在は通常範囲",
      tone: "neutral",
      bg: "from-sky-500/15 to-blue-500/5 border-sky-400/40 dark:from-sky-500/20 dark:to-blue-500/5 dark:border-sky-500/30",
    },
    {
      icon: Flame,
      label: "緊急アラート",
      value: !loaded ? "…" : newsOk ? `${critical} 件` : "—",
      sub: !loaded
        ? "読み込み中…"
        : !newsOk
          ? UNAVAILABLE
          : critical > 0
            ? "緊急シグナル発生中"
            : "現在 0 件",
      tone: !loaded || !newsOk ? "neutral" : critical > 0 ? "alert" : "calm",
      bg:
        loaded && newsOk && critical > 0
          ? "from-red-500/20 to-rose-500/10 border-red-400/50 dark:from-red-500/25 dark:to-rose-500/10 dark:border-red-500/40"
          : loaded && newsOk
            ? "from-emerald-500/12 to-teal-500/5 border-emerald-400/30 dark:from-emerald-500/15 dark:to-teal-500/5 dark:border-emerald-500/25"
            : "from-slate-500/10 to-slate-500/5 border-border",
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
          <div
            key={c.label}
            className="motion-safe:animate-fade-in-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <Card
              className={`relative overflow-hidden border bg-gradient-to-br ${c.bg} transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg ${c.tone === "alert" ? "animate-pulse-soft" : ""}`}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <c.icon className="size-4" />
                    <span>{c.label}</span>
                  </div>
                  {i === cards.length - 1 && (
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  )}
                </div>
                <div className="text-4xl font-bold tracking-tight tabular-nums mb-2">
                  {c.value}
                </div>
                <div
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    c.tone === "alert"
                      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                      : c.tone === "down"
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        : c.tone === "up"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : c.tone === "calm"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                  }`}
                >
                  {c.sub}
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </Link>
  );
}
