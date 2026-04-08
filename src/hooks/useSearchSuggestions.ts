import { useEffect, useRef, useState } from "react";
import { getApiUrl } from "@/lib/utils/apiClient";
import { CapacitorHttp } from "@capacitor/core";

interface SearchSuggestion {
  symbol: string;
  companyName: string;
  exchange?: string;
  score?: number;
  searchType?: string;
}

export function useSearchSuggestions() {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Map<string, SearchSuggestion[]>>(new Map());
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const fetchSuggestions = async (query: string) => {
    if (!query.trim() || query.length < 1) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const options = {
        url: getApiUrl("/api/search-suggestions"),
        headers: {
          "Content-Type": "application/json",
        },
        data: { query },
      };

      const response = await CapacitorHttp.post(options);

      if (response.status !== 200) {
        throw new Error("検索候補の取得に失敗しました");
      }

      if (!mountedRef.current) return;
      const list = response.data.suggestions || [];
      cacheRef.current.set(query, list);
      setSuggestions(list);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error
          ? err.message
          : "検索候補の取得中にエラーが発生しました"
      );
      setSuggestions([]);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  };

  const searchSuggestions = (query: string, debounceMs: number = 200) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    // キャッシュヒット
    const cached = cacheRef.current.get(query);
    if (cached) {
      setSuggestions(cached);
    }
    // デバウンス
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, debounceMs);
  };

  const clearSuggestions = () => {
    setSuggestions([]);
    setError(null);
  };

  return {
    suggestions,
    isLoading,
    error,
    searchSuggestions,
    clearSuggestions,
  };
}
