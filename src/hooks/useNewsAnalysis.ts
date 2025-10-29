import { useState } from "react";
import { NewsAnalysisResult } from "@/lib/api/openrouter";

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
      const response = await fetch("/api/news-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ symbol, companyName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "ニュース分析に失敗しました");
      }

      const data = await response.json();
      setState({
        isLoading: false,
        error: null,
        newsData: data.newsData,
        analysis: data.analysis,
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
