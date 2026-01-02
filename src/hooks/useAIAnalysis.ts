import { useState } from "react";
import { AnalysisResult } from "@/lib/api/openrouter";

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
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyInfo,
          stockData,
          newsData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "分析に失敗しました");
      }

      const data = await response.json();
      setAnalysisResult(data.analysis);
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
