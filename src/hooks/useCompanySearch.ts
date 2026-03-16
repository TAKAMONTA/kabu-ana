import { useState } from "react";
import {
  CompanyInfo,
  StockData,
  ChartDataPoint,
  FinancialData,
} from "@/lib/api/serpapi";
import { getApiUrl } from "@/lib/utils/apiClient";

export interface SearchResultRatios {
  roe?: number;
  roa?: number;
  operatingMargin?: number;
  netMargin?: number;
  grossMargin?: number;
  equityRatio?: number;
  currentRatio?: number;
  deRatio?: number;
  fcf?: number;
  ebitda?: number;
  revenueGrowth?: number;
  niGrowth?: number;
  revenueCagr3y?: number;
  niCagr3y?: number;
  dividendYield?: number;
}

export interface FinancialHistoryItem {
  fiscalYear: number;
  revenue?: number;
  operatingIncome?: number;
  netIncome?: number;
  eps?: number;
  totalAssets?: number;
  cfOperating?: number;
}

export interface SearchResult {
  companyInfo: CompanyInfo;
  stockData: StockData;
  newsData: any[];
  chartData: ChartDataPoint[];
  financialData: FinancialData | null;
  // EDINET DB 拡張フィールド（日本企業の場合のみ存在）
  edinetCode?: string | null;
  accountingStandard?: string | null;
  ratios?: SearchResultRatios | null;
  financialHistory?: FinancialHistoryItem[] | null;
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
        const errorMessage =
          errorData.message ||
          errorData.error ||
          (errorData.details && errorData.details.length > 0
            ? errorData.details.map((d: any) => d.message).join("; ")
            : null) ||
          "検索に失敗しました";
        throw new Error(errorMessage);
      }

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
