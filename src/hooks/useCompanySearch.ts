import { useState } from "react";
import {
  CompanyInfo,
  StockData,
  ChartDataPoint,
  FinancialData,
} from "@/lib/api/serpapi";
import { getApiUrl } from "@/lib/utils/apiClient";

interface SearchResult {
  companyInfo: CompanyInfo;
  stockData: StockData;
  newsData: any[];
  chartData: ChartDataPoint[];
  financialData: FinancialData | null;
}

export function useCompanySearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

  const searchCompany = async (query: string, chartPeriod: string = "1M") => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl("/api/search"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, chartPeriod }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // エラーメッセージを優先的に取得（日本語メッセージを優先）
        const errorMessage = 
          errorData.message || 
          errorData.error || 
          (errorData.details && errorData.details.length > 0 
            ? errorData.details.map((d: any) => d.message).join("; ")
            : null) ||
          "検索に失敗しました";
        throw new Error(errorMessage);
      }

      // レスポンスがJSON形式かどうかをチェック
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("非JSONレスポンス:", text.substring(0, 200));
        throw new Error("APIが利用できません。本番環境のURLが設定されていない可能性があります。");
      }

      const data = await response.json();
      setSearchResult(data);
    } catch (err) {
      let errorMessage = "検索中にエラーが発生しました";
      
      if (err instanceof Error) {
        errorMessage = err.message;
        // JSONパースエラーの場合、より分かりやすいメッセージを表示
        if (err.message.includes("JSON") || err.message.includes("非JSON")) {
          errorMessage = "APIが利用できません。本番環境のURLが設定されていない可能性があります。";
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchResult(null);
    setError(null);
  };

  return {
    isLoading,
    error,
    searchResult,
    searchCompany,
    clearSearch,
  };
}
