import { useState, useRef, useEffect } from "react";
import {
  CompanyInfo,
  StockData,
  ChartDataPoint,
  FinancialData,
} from "@/lib/api/serpapi";
import { getApiUrl } from "@/lib/utils/apiClient";
import { CapacitorHttp } from "@capacitor/core";

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
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const searchCompany = async (query: string, chartPeriod: string = "1M") => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const options = {
        url: getApiUrl("/api/search"),
        headers: {
          "Content-Type": "application/json",
        },
        data: { query, chartPeriod },
      };

      const response = await CapacitorHttp.post(options);

      if (response.status !== 200) {
        throw new Error(response.data?.error || "検索に失敗しました");
      }

      if (!mountedRef.current) return;
      setSearchResult(response.data);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error ? err.message : "検索中にエラーが発生しました"
      );
    } finally {
      if (mountedRef.current) setIsLoading(false);
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
