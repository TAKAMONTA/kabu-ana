import { useEffect, useState } from "react";

export interface TodayPick {
  name: string;
  symbol: string;
}

export function useTodayPicks() {
  const [jp, setJp] = useState<TodayPick[]>([]);
  const [us, setUs] = useState<TodayPick[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPicks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/today-picks", { cache: "no-store" });
      if (!res.ok) throw new Error("注目銘柄の取得に失敗しました");
      const data = await res.json();
      setJp(data.jp || []);
      setUs(data.us || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setJp([]);
      setUs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPicks();
  }, []);

  return { jp, us, isLoading, error, refresh: fetchPicks };
}


