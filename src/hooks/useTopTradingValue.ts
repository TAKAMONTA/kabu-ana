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

// フォールバックデータ（APIが動作しない場合に使用）
const FALLBACK_ITEMS: TradingValueItem[] = [
  {
    rank: 1,
    code: "7203",
    name: "トヨタ自動車",
    reason: "自動車業界の世界的リーダーとして堅調な販売を維持し、電動化や自動運転への取り組みも進む代表的銘柄。",
    confidence: 0.5,
    sources: [],
    price: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    value: 0,
    priceDisplay: "-",
    changeDisplay: "-",
    volumeDisplay: "-",
    valueDisplay: "-",
  },
  {
    rank: 2,
    code: "6758",
    name: "ソニーグループ",
    reason: "エンタメ・半導体・金融など複数の柱を持つ大型株。ゲームやAI向けイメージセンサーに注目。",
    confidence: 0.5,
    sources: [],
    price: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    value: 0,
    priceDisplay: "-",
    changeDisplay: "-",
    volumeDisplay: "-",
    valueDisplay: "-",
  },
  {
    rank: 3,
    code: "8035",
    name: "東京エレクトロン",
    reason: "半導体製造装置で世界シェア上位。生成AI需要による半導体投資拡大が追い風。",
    confidence: 0.5,
    sources: [],
    price: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    value: 0,
    priceDisplay: "-",
    changeDisplay: "-",
    volumeDisplay: "-",
    valueDisplay: "-",
  },
  {
    rank: 4,
    code: "7974",
    name: "任天堂",
    reason: "世界的な人気IPとハードを持つゲーム企業。新ハード発表や大型タイトルに常に注目が集まる。",
    confidence: 0.5,
    sources: [],
    price: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    value: 0,
    priceDisplay: "-",
    changeDisplay: "-",
    volumeDisplay: "-",
    valueDisplay: "-",
  },
  {
    rank: 5,
    code: "9984",
    name: "ソフトバンクグループ",
    reason: "投資事業を通じてAIやテック関連のニュースが多く、マーケットの話題を集めやすい。",
    confidence: 0.5,
    sources: [],
    price: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    value: 0,
    priceDisplay: "-",
    changeDisplay: "-",
    volumeDisplay: "-",
    valueDisplay: "-",
  },
];

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
      const { getApiUrl } = await import("@/lib/utils/apiClient");
      const apiUrl = getApiUrl("/api/top-trading-value");
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
      // APIが動作しない場合（静的エクスポートやエミュレーター環境など）、フォールバックデータを表示
      console.warn("API取得エラー、フォールバックデータを使用:", err);
      
      // フォールバックデータを設定
      setItems(FALLBACK_ITEMS);
      
      // エラーメッセージは表示しない（フォールバックデータを表示するため）
      setError(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { items, isLoading, error, refresh: fetchRanking };
}

