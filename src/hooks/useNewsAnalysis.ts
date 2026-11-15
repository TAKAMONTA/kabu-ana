import { useState, useRef, useCallback, useEffect } from "react";
import { NewsAnalysisResult } from "@/lib/api/openrouter";
import { getApiUrl, getAuthHeaders } from "@/lib/utils/apiClient";
import { CapacitorHttp } from "@capacitor/core";
import { toFriendlyErrorMessage } from "@/lib/friendlyError";

const NEWS_ERROR_FALLBACK =
  "ニュースの分析を取得できませんでした。少し待ってから再試行してください。";

interface NewsAnalysisState {
  isLoading: boolean;
  error: string | null;
  newsData: any[] | null;
  analysis: NewsAnalysisResult | null;
  empty: boolean;
}

export function useNewsAnalysis() {
  const [state, setState] = useState<NewsAnalysisState>({
    isLoading: false,
    error: null,
    newsData: null,
    analysis: null,
    empty: false,
  });
  const lastArgsRef = useRef<{ symbol: string; companyName: string } | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const analyzeNews = useCallback(
    async (
      symbol: string,
      companyName: string,
      options?: { bundleToken?: string }
    ) => {
      lastArgsRef.current = { symbol, companyName };
      setState(prev => ({ ...prev, isLoading: true, error: null, empty: false }));

      try {
        const headers = await getAuthHeaders();
        if (options?.bundleToken) {
          headers["X-AI-Bundle-Token"] = options.bundleToken;
        }
        const requestOptions = {
          url: getApiUrl("/api/news-analysis"),
          headers,
          data: { symbol, companyName },
        };

        const response = await CapacitorHttp.post(requestOptions);

        if (response.status !== 200) {
          throw new Error(response.data?.error || NEWS_ERROR_FALLBACK);
        }

        if (!mountedRef.current) return;
        setState({
          isLoading: false,
          error: null,
          newsData: response.data.newsData,
          analysis: response.data.analysis,
          empty: Boolean(response.data.empty),
        });
      } catch (err) {
        if (!mountedRef.current) return;
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: toFriendlyErrorMessage(
            err instanceof Error ? err.message : null,
            NEWS_ERROR_FALLBACK
          ),
        }));
      }
    },
    []
  );

  const retry = useCallback(() => {
    if (lastArgsRef.current) {
      const { symbol, companyName } = lastArgsRef.current;
      analyzeNews(symbol, companyName);
    }
  }, [analyzeNews]);

  const clearAnalysis = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      newsData: null,
      analysis: null,
      empty: false,
    });
  }, []);

  return {
    ...state,
    analyzeNews,
    clearAnalysis,
    retry,
  };
}
