export interface CompanyInfo {
  name: string;
  symbol: string;
  market: string;
  price?: number;
  change?: number;
  /** %値で統一する。例: 8.6 は 8.6% を意味し、0.086 の割合値は使わない。 */
  changePercent?: number;
  description?: string;
  website?: string;
  employees?: string;
  founded?: string;
  headquarters?: string;
}

export interface StockData {
  symbol: string;
  price: number;
  change: number;
  /** %値で統一する。例: 8.6 は 8.6% を意味し、0.086 の割合値は使わない。 */
  changePercent: number;
  volume: number;
  marketCap: string;
  pe: number;
  eps: number;
  dividend: number;
  high52: number;
  low52: number;
}

export interface ChartDataPoint {
  date: string;
  price: number;
  volume: number;
  keyEvent?: {
    title: string;
    link: string;
    source: string;
  };
}

export interface FinancialData {
  revenue?: string;
  netIncome?: string;
  operatingIncome?: string;
  totalAssets?: string;
  totalLiabilities?: string;
  cash?: string;
  eps?: string;
  period?: string;
}

export type NewsItem = {
  title: string;
  snippet: string;
  source: string;
  date: string;
  link: string;
};

export interface FastSearchResult {
  companyInfo: CompanyInfo;
  stockData: StockData;
  newsData: NewsItem[];
  chartData: ChartDataPoint[];
  financialData: FinancialData | null;
}

/** MarketDataClient が満たすメソッド面 */
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
