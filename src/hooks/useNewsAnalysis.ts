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
  // 再試行でも同梱トークン（無料回数を消費しない）を付け直せるよう、オプションごと覚えておく
  const lastArgsRef = useRef<{
    symbol: string;
    companyName: string;
    options?: { bundleToken?: string };
  } | null>(null);
  const mountedRef = useRef(true);
  // 銘柄を切り替えたあとに前の銘柄の応答が届いても反映しない
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const analyzeNews = useCallback(
    async (
      symbol: string,
      companyName: string,
      options?: { bundleToken?: string }
    ) => {
      const requestId = ++requestIdRef.current;
      const isCurrent = () =>
        mountedRef.current && requestIdRef.current === requestId;
      lastArgsRef.current = { symbol, companyName, options };
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

        if (!isCurrent()) return;
        setState({
          isLoading: false,
          error: null,
          newsData: response.data.newsData,
          analysis: response.data.analysis,
          empty: Boolean(response.data.empty),
        });
      } catch (err) {
        if (!isCurrent()) return;
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
      const { symbol, companyName, options } = lastArgsRef.current;
      void analyzeNews(symbol, companyName, options);
    }
  }, [analyzeNews]);

  /** 結果・エラー・再試行の対象を破棄し、実行中の応答も反映しないようにする */
  const clearAnalysis = useCallback(() => {
    requestIdRef.current++;
    lastArgsRef.current = null;
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
