"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApiUrl } from "@/lib/utils/apiClient";
import { CapacitorHttp } from "@capacitor/core";

export interface TradingValueItem {
  rank: number;
  code: string;
  name: string;
  reason: string;
  confidence: number;
  sources: string[];
  signalLabel?: string;
  evidence?: string;
  sourceLinks?: string[];
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

const translateWarningCode = (code: string): string | null => {
  switch (code) {
    case "news_unavailable":
      return "現在、候補にできるニュース材料を取得できていません。";
    case "news_low_signal":
      return "ニュースは取得できましたが、企業名を確認できる材料が少ないため、候補を無理に増やしていません。";
    case "news_partial_signal":
      return "ニュース内で企業名を確認できた銘柄だけを表示しています。";
    case "stale_signal":
      return "最新取得に失敗したため、直近に取得できた候補を表示しています。";
    default:
      return null;
  }
};

const translateErrorCode = (code: string): string | null => {
  switch (code) {
    case "api_key_missing":
      return "外部株価APIキーが未設定です。";
    case "fmp_forbidden":
      return "外部株価APIのアクセス制限により最新ランキングを取得できませんでした。";
    case "empty_response":
      return "外部株価APIから有効なデータが得られませんでした。";
    case "ranking_fetch_failed":
      return "ランキングの取得に失敗しました。時間をおいて再度お試しください。";
    case "news_unavailable":
      return "最新ニュースを取得できませんでした。";
    case "openrouter_api_key_missing":
      return "OpenRouterのAPIキーが未設定です。.env.localファイルにOPENROUTER_API_KEYを設定してください。";
    case "openrouter_timeout":
      return "AI分析のタイムアウトが発生しました。しばらくしてから再度お試しください。";
    case "openrouter_unauthorized":
      return "OpenRouterのAPIキーが無効です。正しいAPIキーを設定してください。";
    case "openrouter_rate_limit":
      return "APIの利用制限に達しました。しばらくしてから再度お試しください。";
    case "openrouter_server_error":
      return "OpenRouterサーバーでエラーが発生しました。しばらくしてから再度お試しください。";
    case "openrouter_invalid_response":
      return "AI分析の応答形式が不正でした。";
    case "openrouter_empty":
      return "AI分析から注目銘柄が得られませんでした。";
    case "openrouter_failed":
      return "AI分析で注目銘柄を生成できませんでした。";
    default:
      return null;
  }
};

export function useTopTradingValue() {
  const [items, setItems] = useState<TradingValueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchRanking = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setWarning(null);
    try {
      const apiUrl = getApiUrl("/api/top-trading-value");
      const requestUrl =
        typeof window !== "undefined"
          ? new URL(apiUrl, window.location.origin).toString()
          : apiUrl;

      const options = {
        url: requestUrl,
        headers: { "Content-Type": "application/json" }
      };

      const response = await CapacitorHttp.get(options);
      const { status, data } = response;

      if (status !== 200) {
        // エラーレスポンスでもJSON形式の可能性があるので、パースを試みる
        const errorData = data;
        const errorCode = errorData?.error || "ranking_fetch_failed";
        const friendlyMessage = translateErrorCode(errorCode);
        throw new Error(friendlyMessage || `ランキングの取得に失敗しました（ステータス: ${status}）`);
      }

      if (!mountedRef.current) return;
      const itemsFromApi = Array.isArray(data.items) ? data.items : [];
      setItems(itemsFromApi);

      if (data.warning) {
        setWarning(translateWarningCode(data.warning) || null);
      }

      if (data.error) {
        const friendlyMessage = translateErrorCode(data.error);
        if (friendlyMessage) {
          setError(friendlyMessage);
        }
      } else {
        setError(null);
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("エラーが発生しました");
      }
      setItems([]);
      setWarning(null);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchRanking();
    return () => { mountedRef.current = false; };
  }, [fetchRanking]);

  return { items, isLoading, error, warning, refresh: fetchRanking };
}
