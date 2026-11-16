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
export const NOT_FOUND_MESSAGE =
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

export interface SearchOptions {
  /**
   * 失敗したら表示中の結果も消す。別の銘柄を探す検索で使い、
   * 失敗後に前の銘柄の画面（分析は破棄済み）が中途半端に残らないようにする。
   * チャート期間の切替では使わない
   */
  clearOnError?: boolean;
}

export function useCompanySearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const mountedRef = useRef(true);
  const lastRequestRef = useRef<{
    query: string;
    chartPeriod: string;
    options?: SearchOptions;
  } | null>(null);
  // 連続で検索したとき、先に投げた検索の応答が後から届いても反映しない
  const requestIdRef = useRef(0);

  useEffect(() => {
    // StrictMode の二重マウントや Fast Refresh の再マウント後に
    // フラグが false のまま残ると、以後の検索結果が永久に捨てられる
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** 検索する。結果を反映できたら true */
  const searchCompany = async (
    query: string,
    chartPeriod: string = "1M",
    options?: SearchOptions
  ): Promise<boolean> => {
    if (!query.trim()) return false;

    const requestId = ++requestIdRef.current;
    const isCurrent = () =>
      mountedRef.current && requestIdRef.current === requestId;
    lastRequestRef.current = { query, chartPeriod, options };
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

      if (!isCurrent()) return false;
      setSearchResult(response.data);
      return true;
    } catch (err) {
      if (!isCurrent()) return false;
      if (options?.clearOnError) setSearchResult(null);
      setError(
        toFriendlyErrorMessage(
          err instanceof Error ? err.message : null,
          SEARCH_ERROR_FALLBACK
        )
      );
      return false;
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  };

  const retry = () => {
    const last = lastRequestRef.current;
    if (last) return searchCompany(last.query, last.chartPeriod, last.options);
  };

  /** 検索結果とエラーを消し、実行中の検索の応答も反映しないようにする */
  const clearSearch = () => {
    requestIdRef.current++;
    lastRequestRef.current = null;
    setSearchResult(null);
    setError(null);
    setIsLoading(false);
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
