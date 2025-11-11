import { useRef, useState } from "react";

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
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Map<string, SearchSuggestion[]>>(new Map());

  const fetchSuggestions = async (query: string) => {
    if (!query.trim() || query.length < 1) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 直前のリクエストをキャンセル
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      const response = await fetch("/api/search-suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("検索候補の取得に失敗しました");
      }

      const data = await response.json();
      const list = data.suggestions || [];
      cacheRef.current.set(query, list);
      setSuggestions(list);
    } catch (err) {
      if ((err as any)?.name === "AbortError") return;
      setError(
        err instanceof Error
          ? err.message
          : "検索候補の取得中にエラーが発生しました"
      );
      setSuggestions([]);
    } finally {
      setIsLoading(false);
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
