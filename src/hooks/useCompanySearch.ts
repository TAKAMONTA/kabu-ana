import { useState, useRef, useEffect } from "react";
import {
  CompanyInfo,
  StockData,
  ChartDataPoint,
  FinancialData,
} from "@/lib/api/marketDataTypes";
import { getApiUrl } from "@/lib/utils/apiClient";
import { CapacitorHttp } from "@capacitor/core";
import type { EdinetStatus } from "@/lib/dataStatus";
import { toFriendlyErrorMessage } from "@/lib/friendlyError";

const SEARCH_ERROR_FALLBACK =
  "検索中にエラーが発生しました。もう一度お試しください。";
const NOT_FOUND_MESSAGE =
  "該当する銘柄が見つかりませんでした。証券コード（例: 7203）やティッカー（例: AAPL）でもお試しください。";

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
  metadata?: {
    dataSource?: string;
    edinetStatus?: EdinetStatus;
    /** サーバーがデータを取得し終えた時刻（ISO 8601） */
    fetchedAt?: string;
  } | null;
}

export function useCompanySearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const mountedRef = useRef(true);
  const lastRequestRef = useRef<{ query: string; chartPeriod: string } | null>(
    null
  );

  useEffect(() => {
    // StrictMode の二重マウントや Fast Refresh の再マウント後に
    // フラグが false のまま残ると、以後の検索結果が永久に捨てられる
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const searchCompany = async (query: string, chartPeriod: string = "1M") => {
    if (!query.trim()) return;

    lastRequestRef.current = { query, chartPeriod };
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

      if (response.status === 404) {
        throw new Error(NOT_FOUND_MESSAGE);
      }
      if (response.status !== 200) {
        throw new Error(
          response.status === 429
            ? "429"
            : response.data?.error || SEARCH_ERROR_FALLBACK
        );
      }

      if (!mountedRef.current) return;
      setSearchResult(response.data);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        toFriendlyErrorMessage(
          err instanceof Error ? err.message : null,
          SEARCH_ERROR_FALLBACK
        )
      );
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  };

  const retry = () => {
    const last = lastRequestRef.current;
    if (last) return searchCompany(last.query, last.chartPeriod);
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
    retry,
    clearSearch,
  };
}
