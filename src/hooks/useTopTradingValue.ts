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
        return "AI分析の応答形式が不正でした。人気銘柄のサンプルを表示しています。";
      case "openrouter_empty":
        return "AI分析から推奨銘柄が得られなかったため、人気銘柄のサンプルを表示しています。";
      case "openrouter_failed":
        return "AI分析で注目銘柄を生成できなかったため、人気銘柄のサンプルを表示しています。";
      default:
        return null;
    }
  };

  const fetchRanking = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // モバイルアプリ（Capacitor）でも動作するように、ベースURLを動的に取得
      const getApiBaseUrl = () => {
        // 環境変数でベースURLが指定されている場合はそれを使用
        if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) {
          return process.env.NEXT_PUBLIC_API_BASE_URL;
        }
        // モバイルアプリ（Capacitor）の場合は現在のオリジンを使用
        if (typeof window !== "undefined" && window.location.origin) {
          return window.location.origin;
        }
        // デフォルトは相対パス（Web版）
        return "";
      };
      
      const apiBaseUrl = getApiBaseUrl();
      const apiUrl = `${apiBaseUrl}/api/top-trading-value`;
      const res = await fetch(apiUrl, { cache: "no-store" });
      
      // レスポンスがJSON形式かどうかをチェック
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("非JSONレスポンス:", text.substring(0, 200));
        throw new Error("サーバーからの応答形式が不正です");
      }
      
      if (!res.ok) {
        // エラーレスポンスでもJSON形式の可能性があるので、パースを試みる
        try {
          const errorData = await res.json();
          const errorCode = errorData.error || "ranking_fetch_failed";
          const friendlyMessage = translateErrorCode(errorCode);
          throw new Error(friendlyMessage || "ランキングの取得に失敗しました");
        } catch (parseErr) {
          // JSONパースに失敗した場合は、ステータスコードからエラーメッセージを生成
          throw new Error(`ランキングの取得に失敗しました（ステータス: ${res.status}）`);
        }
      }
      
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
      // JSONパースエラーの場合、より分かりやすいメッセージを表示
      if (err instanceof SyntaxError && err.message.includes("JSON")) {
        console.error("JSONパースエラー:", err);
        setError("サーバーからの応答を解析できませんでした。しばらくしてから再度お試しください。");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("エラーが発生しました");
      }
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

