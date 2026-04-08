import { useState, useRef, useEffect } from "react";
import {
  CompanyInfo,
  StockData,
  ChartDataPoint,
  FinancialData,
} from "@/lib/api/serpapi";
import { getApiUrl } from "@/lib/utils/apiClient";
import { CapacitorHttp } from "@capacitor/core";

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
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
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
