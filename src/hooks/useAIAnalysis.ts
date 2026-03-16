import { useState } from "react";
import { AnalysisResult } from "@/lib/api/openrouter";
import { getApiUrl } from "@/lib/utils/apiClient";

export function useAIAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );

  const cleanData = (obj: any): any => {
    if (obj === null || obj === undefined) return undefined;
    if (Array.isArray(obj)) return obj.map(cleanData);
    if (typeof obj === "object") {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        cleaned[key] = value === null ? undefined : value;
      }
      return cleaned;
    }
    return obj;
  };

  const analyzeStock = async (
    companyInfo: any,
    stockData: any,
    newsData: any[],
    edinetExtras?: { ratios?: any; financialHistory?: any[]; accountingStandard?: string | null }
  ) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const cleanedStockData = cleanData(stockData) || {};
      const cleanedNewsData = (newsData || []).map((item: any) => ({
        title: item.title || "",
        snippet: item.snippet || "",
        link: item.link || "",
        source: item.source || "",
        date: item.date || "",
      }));

      const response = await fetch(getApiUrl("/api/analyze"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyInfo: cleanData(companyInfo),
          stockData: cleanedStockData,
          newsData: cleanedNewsData,
          edinetExtras,
        }),
      });

      // レスポンスがJSON形式かどうかをチェック
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("非JSONレスポンス:", text.substring(0, 200));
        throw new Error("APIが利用できません。本番環境（Web版）でご利用ください。");
      }

      if (!response.ok) {
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || "分析に失敗しました");
        } catch (parseErr) {
          throw new Error(`分析に失敗しました（ステータス: ${response.status}）`);
        }
      }

      const data = await response.json();
      setAnalysisResult(data.analysis);
    } catch (err) {
      if (err instanceof TypeError && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError"))) {
        setError("ネットワークエラーが発生しました。接続を確認してください。");
      } else if (err instanceof SyntaxError || (err instanceof Error && err.message.includes("JSON"))) {
        setError("サーバーとの通信に問題が発生しました。しばらくしてから再試行してください。");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("分析中にエラーが発生しました");
      }
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
