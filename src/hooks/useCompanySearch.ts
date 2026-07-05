import { useState, useRef, useEffect } from "react";
import {
  CompanyInfo,
  StockData,
  ChartDataPoint,
  FinancialData,
} from "@/lib/api/marketDataTypes";
import { postJson } from "@/lib/utils/apiClient";
import {
  getSearchQueryError,
  normalizeChartPeriod,
  normalizeSearchQuery,
} from "@/lib/validation/schemas";

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
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const searchCompany = async (query: string, chartPeriod: string = "1M") => {
    const validationError = getSearchQueryError(query);
    if (validationError) {
      setError(validationError);
      return;
    }

    const normalizedQuery = normalizeSearchQuery(query);
    const safeChartPeriod = normalizeChartPeriod(chartPeriod);

    setIsLoading(true);
    setError(null);

    try {
      const response = await postJson<
        SearchResult & { error?: string; details?: { message: string }[] }
      >("/api/search", { query: normalizedQuery, chartPeriod: safeChartPeriod });

      if (response.status !== 200) {
        const detail = response.data?.details?.[0]?.message;
        throw new Error(detail || response.data?.error || "検索に失敗しました");
      }

      if (!mountedRef.current) return;
      setSearchResult(response.data);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error ? err.message : "検索中にエラーが発生しました"
      );
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
