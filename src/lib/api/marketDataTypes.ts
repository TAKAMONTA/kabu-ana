import type {
  CompanyInfo,
  StockData,
  ChartDataPoint,
  FinancialData,
  FastSearchResult,
} from "./serpapi";

export type {
  CompanyInfo,
  StockData,
  ChartDataPoint,
  FinancialData,
  FastSearchResult,
};

export type NewsItem = {
  title: string;
  snippet: string;
  source: string;
  date: string;
  link: string;
};

/** SerpApiClient と YahooFinanceClient が共通で満たすメソッド面 */
export interface MarketDataClient {
  getFastSearchResult(
    query: string,
    window?: string
  ): Promise<FastSearchResult | null>;
  searchCompany(query: string): Promise<CompanyInfo | null>;
  searchCompanyByGoogle(query: string): Promise<CompanyInfo | null>;
  getStockData(symbol: string): Promise<StockData | null>;
  getCompanyNews(symbol: string, limit?: number): Promise<NewsItem[]>;
  getCompanyNewsFromGoogle(
    symbol: string,
    companyName: string,
    limit?: number
  ): Promise<NewsItem[]>;
  getChartData(symbol: string, window?: string): Promise<ChartDataPoint[]>;
  getFinancialData(symbol: string): Promise<FinancialData | null>;
}
