import { useState } from "react";
import { AnalysisResult } from "@/lib/api/openrouter";
import { getApiUrl, getAuthHeaders } from "@/lib/utils/apiClient";
import { CapacitorHttp } from "@capacitor/core";

export function useAIAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );

  const analyzeStock = async (
    companyInfo: any,
    stockData: any,
    newsData: any[]
  ) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const options = {
        url: getApiUrl("/api/analyze"),
        headers,
        data: {
          companyInfo,
          stockData,
          newsData,
        },
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
  };

  const clearAnalysis = () => {
    setAnalysisResult(null);
    setError(null);
  };

  return {
    isAnalyzing,
    error,
    analysisResult,
    analyzeStock,
    clearAnalysis,
  };
}
