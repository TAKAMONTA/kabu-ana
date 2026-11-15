"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApiUrl } from "@/lib/utils/apiClient";
import { CapacitorHttp } from "@capacitor/core";
import { toFriendlyErrorMessage } from "@/lib/friendlyError";

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
      return "今はニュースを取得できていません。時間をおいて再度ご確認ください。";
    case "news_low_signal":
      return "今日は名前が挙がった銘柄が少ないため、無理に候補を増やしていません。";
    case "news_partial_signal":
      return "ニュースで名前が挙がった銘柄だけを表示しています。";
    case "stale_signal":
      return "最新のニュースを取得できなかったため、少し前の候補を表示しています。";
    default:
      return null;
  }
};

/** 画面に出すランキング取得失敗の案内（理由の詳細は利用者に対処できないので出さない） */
export const RANKING_ERROR_MESSAGE =
  "話題の銘柄を取得できませんでした。少し待ってから再読み込みしてください。";

// /api/top-trading-value が返すエラーコードは ranking_fetch_failed のみ
// （route.ts の catch 節）。以前あった APIキー未設定などのコードは
// どこからも返らないため削除した。
const translateErrorCode = (code: string): string | null => {
  switch (code) {
    case "ranking_fetch_failed":
      return RANKING_ERROR_MESSAGE;
    default:
      return null;
  }
};

export function useTopTradingValue() {
  const [items, setItems] = useState<TradingValueItem[]>([]);
  // マウント直後に取得を始めるので、初期表示（プリレンダー含む）から読み込み中にする。
  // false だと取得前に「まだありません」と表示されてしまう
  const [isLoading, setIsLoading] = useState(true);
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
        headers: { "Content-Type": "application/json" },
      };

      const response = await CapacitorHttp.get(options);
      const { status, data } = response;

      if (status !== 200) {
        throw new Error(
          translateErrorCode(data?.error ?? "") ?? RANKING_ERROR_MESSAGE
        );
      }

      if (!mountedRef.current) return;
      const itemsFromApi = Array.isArray(data?.items) ? data.items : [];
      setItems(itemsFromApi);

      if (data?.warning) {
        setWarning(translateWarningCode(data.warning) || null);
      }

      if (data?.error) {
        setError(translateErrorCode(data.error) ?? RANKING_ERROR_MESSAGE);
      } else {
        setError(null);
      }
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setError(
        toFriendlyErrorMessage(
          err instanceof Error ? err.message : null,
          RANKING_ERROR_MESSAGE
        )
      );
      setItems([]);
      setWarning(null);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchRanking();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchRanking]);

  return { items, isLoading, error, warning, refresh: fetchRanking };
}
