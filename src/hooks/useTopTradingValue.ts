"use client";

import { useEffect, useState } from "react";

export interface TradingValueItem {
  rank: number;
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  value: number;
  priceDisplay: string;
  changeDisplay: string;
  volumeDisplay: string;
  valueDisplay: string;
}

export function useTopTradingValue() {
  const [items, setItems] = useState<TradingValueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRanking = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/top-trading-value", { cache: "no-store" });
      if (!res.ok) throw new Error("ランキングの取得に失敗しました");
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRanking();
  }, []);

  return { items, isLoading, error, refresh: fetchRanking };
}

