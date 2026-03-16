import { useState, useEffect } from "react";
import { getApiUrl } from "@/lib/utils/apiClient";
import { EdinetRankingItem } from "@/lib/api/edinetdb";

export const RANKING_METRICS = [
  { value: "roe", label: "ROE" },
  { value: "roa", label: "ROA" },
  { value: "operating-margin", label: "営業利益率" },
  { value: "revenue-growth", label: "売上成長率" },
  { value: "dividend-yield", label: "配当利回り" },
  { value: "equity-ratio", label: "自己資本比率" },
] as const;

export type RankingMetric = typeof RANKING_METRICS[number]["value"];

export function useRanking(metric: RankingMetric = "roe", limit = 10) {
  const [items, setItems] = useState<EdinetRankingItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(getApiUrl(`/api/rankings?metric=${metric}&limit=${limit}`))
      .then(res => {
        if (!res.ok) throw new Error("ランキングの取得に失敗しました");
        return res.json();
      })
      .then(data => {
        if (!cancelled) {
          setItems(data.data || []);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message || "ランキングの取得に失敗しました");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [metric, limit]);

  return { items, isLoading, error };
}
