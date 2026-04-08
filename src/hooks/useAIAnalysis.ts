import { useState, useRef, useCallback } from "react";
import { AnalysisResult } from "@/lib/api/openrouter";
import { getApiUrl, getAuthHeaders } from "@/lib/utils/apiClient";
import { CapacitorHttp } from "@capacitor/core";

export function useAIAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const lastArgsRef = useRef<{ companyInfo: any; stockData: any; newsData: any[] } | null>(null);

  const analyzeStock = useCallback(async (
    companyInfo: any,
    stockData: any,
    newsData: any[]
  ) => {
    lastArgsRef.current = { companyInfo, stockData, newsData };
    setIsAnalyzing(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const options = {
        url: getApiUrl("/api/analyze"),
        headers,
        data: { companyInfo, stockData, newsData },
      };

      const response = await CapacitorHttp.post(options);

      if (response.status !== 200) {
        throw new Error(response.data?.error || "分析に失敗しました");
      }

      setAnalysisResult(response.data.analysis);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "分析中にエラーが発生しました"
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const retry = useCallback(() => {
    if (lastArgsRef.current) {
      const { companyInfo, stockData, newsData } = lastArgsRef.current;
      analyzeStock(companyInfo, stockData, newsData);
    }
  }, [analyzeStock]);

  const clearAnalysis = useCallback(() => {
    setAnalysisResult(null);
    setError(null);
  }, []);

  return {
    isAnalyzing,
    error,
    analysisResult,
    analyzeStock,
    clearAnalysis,
    retry,
  };
}
