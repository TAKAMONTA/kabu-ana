import yahooFinance from "yahoo-finance2";
import { JPX_STOCK_BY_CODE } from "@/lib/jpx/stockMaster";
import type {
  CompanyInfo,
  StockData,
  ChartDataPoint,
  FinancialData,
  FastSearchResult,
  MarketDataClient,
  NewsItem,
} from "./marketDataTypes";

/** 入力クエリ/シンボルを Yahoo Finance のティッカー表記へ正規化する */
export function toYahooSymbol(raw: string): string {
  const normalized = String(raw).normalize("NFKC").trim().toUpperCase();
  const [core, exchange] = normalized.split(":");
  const code = (core ?? "").trim();
  if (/^\d{4}$/.test(code)) return `${code}.T`;
  if (exchange === "TYO") return `${code}.T`;
  return code;
}

/** SerpAPI の window 値を Yahoo chart の {period1, interval} へ変換する */
export function windowToRange(window: string = "1M"): {
  period1: Date;
  interval: "5m" | "15m" | "1d" | "1wk" | "1mo";
} {
  const day = 86_400_000;
  const table: Record<
    string,
    { ms: number; interval: "5m" | "15m" | "1d" | "1wk" | "1mo" }
  > = {
    "1D": { ms: 1 * day, interval: "5m" },
    "5D": { ms: 5 * day, interval: "15m" },
    "1M": { ms: 31 * day, interval: "1d" },
    "6M": { ms: 183 * day, interval: "1d" },
    "1Y": { ms: 365 * day, interval: "1d" },
    "5Y": { ms: 5 * 365 * day, interval: "1wk" },
    MAX: { ms: 30 * 365 * day, interval: "1mo" },
  };
  const entry = table[window] ?? table["1M"];
  return { period1: new Date(Date.now() - entry.ms), interval: entry.interval };
}

function toStr(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : String(value);
}

export class YahooFinanceClient implements MarketDataClient {
  constructor() {
    (yahooFinance as unknown as { suppressNotices?: (k: string[]) => void })
      .suppressNotices?.(["yahooSurvey"]);
  }

  async getFastSearchResult(
    _query: string,
    _window: string = "1M"
  ): Promise<FastSearchResult | null> {
    return null;
  }

  async searchCompany(_query: string): Promise<CompanyInfo | null> {
    return null;
  }

  async searchCompanyByGoogle(_query: string): Promise<CompanyInfo | null> {
    return null;
  }

  async getStockData(symbol: string): Promise<StockData | null> {
    try {
      const ys = toYahooSymbol(symbol);
      const q = await yahooFinance.quote(ys);
      if (!q) return null;
      return {
        symbol: q.symbol ?? ys,
        price: q.regularMarketPrice ?? 0,
        change: q.regularMarketChange ?? 0,
        changePercent: q.regularMarketChangePercent ?? 0,
        volume: q.regularMarketVolume ?? 0,
        marketCap: q.marketCap !== undefined ? String(q.marketCap) : "N/A",
        pe: q.trailingPE ?? 0,
        eps: q.epsTrailingTwelveMonths ?? 0,
        dividend: q.trailingAnnualDividendYield
          ? q.trailingAnnualDividendYield * 100
          : 0,
        high52: q.fiftyTwoWeekHigh ?? 0,
        low52: q.fiftyTwoWeekLow ?? 0,
      };
    } catch (error) {
      console.error(
        "Yahoo 株価取得エラー:",
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }

  async getCompanyNews(
    _symbol: string,
    _limit: number = 10
  ): Promise<NewsItem[]> {
    return [];
  }

  async getCompanyNewsFromGoogle(
    _symbol: string,
    _companyName: string,
    _limit: number = 10
  ): Promise<NewsItem[]> {
    return [];
  }

  async getChartData(
    symbol: string,
    window: string = "1M"
  ): Promise<ChartDataPoint[]> {
    try {
      const ys = toYahooSymbol(symbol);
      const { period1, interval } = windowToRange(window);
      const result = await yahooFinance.chart(ys, { period1, interval });
      const quotes = result?.quotes ?? [];
      return quotes
        .filter(p => p && p.date)
        .map(p => ({
          date: new Date(p.date as Date).toISOString().slice(0, 10),
          price: p.close ?? 0,
          volume: p.volume ?? 0,
        }));
    } catch (error) {
      console.error(
        "Yahoo チャート取得エラー:",
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }

  async getFinancialData(symbol: string): Promise<FinancialData | null> {
    try {
      const ys = toYahooSymbol(symbol);
      const summary = await yahooFinance.quoteSummary(ys, {
        modules: [
          "incomeStatementHistory",
          "balanceSheetHistory",
          "defaultKeyStatistics",
        ],
      });
      const income =
        summary?.incomeStatementHistory?.incomeStatementHistory?.[0];
      if (!income) return null;
      const balance =
        summary?.balanceSheetHistory?.balanceSheetStatements?.[0];
      const eps = summary?.defaultKeyStatistics?.trailingEps;
      const year = income.endDate
        ? new Date(income.endDate as Date).getFullYear()
        : "";
      return {
        revenue: toStr(income.totalRevenue),
        netIncome: toStr(income.netIncome),
        operatingIncome: toStr(income.operatingIncome),
        totalAssets: toStr(balance?.totalAssets),
        totalLiabilities: toStr(balance?.totalLiab),
        cash: toStr(balance?.cash),
        eps: toStr(eps),
        period: `${year} (FY)`,
      };
    } catch (error) {
      console.error(
        "Yahoo 財務取得エラー:",
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }
}

// JPX_STOCK_BY_CODE と toStr は後続タスクで使用するため参照を維持
void JPX_STOCK_BY_CODE;
void toStr;
