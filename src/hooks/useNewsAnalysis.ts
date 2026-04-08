import { useState } from "react";
import { NewsAnalysisResult } from "@/lib/api/openrouter";
import { getApiUrl, getAuthHeaders } from "@/lib/utils/apiClient";
import { CapacitorHttp } from "@capacitor/core";

interface NewsAnalysisState {
  isLoading: boolean;
  error: string | null;
  newsData: any[] | null;
  analysis: NewsAnalysisResult | null;
}

export function useNewsAnalysis() {
  const [state, setState] = useState<NewsAnalysisState>({
    isLoading: false,
    error: null,
    newsData: null,
    analysis: null,
  });

  const analyzeNews = async (symbol: string, companyName: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const headers = await getAuthHeaders();
      const options = {
        url: getApiUrl("/api/news-analysis"),
        headers,
        data: { symbol, companyName },
      };

      const response = await CapacitorHttp.post(options);

      if (response.status !== 200) {
        throw new Error(response.data?.error || "ニュース分析に失敗しました");
      }

      setState({
        isLoading: false,
        error: null,
        newsData: response.data.newsData,
        analysis: response.data.analysis,
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error:
          err instanceof Error
            ? err.message
            : "ニュース分析中にエラーが発生しました",
      }));
    }
  };

  const clearAnalysis = () => {
    setState({
      isLoading: false,
      error: null,
      newsData: null,
      analysis: null,
    });
  };

  return {
    ...state,
    analyzeNews,
    clearAnalysis,
  };
}
