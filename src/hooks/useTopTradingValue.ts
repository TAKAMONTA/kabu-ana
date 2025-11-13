"use client";

import { useEffect, useState } from "react";

export interface TradingValueItem {
  rank: number;
  code: string;
  name: string;
  reason: string;
  confidence: number;
  sources: string[];
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

  const translateErrorCode = (code: string): string | null => {
    switch (code) {
      case "api_key_missing":
        return "外部株価APIキーが未設定のため、人気銘柄のサンプルを表示しています。";
      case "fmp_forbidden":
        return "外部株価APIのアクセス制限により最新ランキングを取得できませんでした。人気銘柄のサンプルを表示しています。";
      case "empty_response":
        return "外部株価APIから有効なデータが得られませんでした。人気銘柄のサンプルを表示しています。";
      case "ranking_fetch_failed":
        return "ランキングの取得に失敗しました。時間をおいて再度お試しください。";
      case "news_unavailable":
        return "最新ニュースを取得できなかったため、人気銘柄のサンプルを表示しています。";
      case "openrouter_api_key_missing":
        return "OpenRouterのAPIキーが未設定のため、人気銘柄のサンプルを表示しています。";
      case "openrouter_failed":
        return "AI分析で注目銘柄を生成できなかったため、人気銘柄のサンプルを表示しています。";
      case "openrouter_empty":
        return "AI分析から推奨銘柄が得られなかったため、人気銘柄のサンプルを表示しています。";
      default:
        return null;
    }
  };

  const fetchRanking = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/top-trading-value", { cache: "no-store" });
      if (!res.ok) throw new Error("ランキングの取得に失敗しました");
      const data = await res.json();
      const itemsFromApi = Array.isArray(data.items) ? data.items : [];
      setItems(itemsFromApi);

      if (data.error) {
        const friendlyMessage = translateErrorCode(data.error);
        if (friendlyMessage) {
          setError(friendlyMessage);
        }
      } else {
        setError(null);
      }
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

