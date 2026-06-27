import { JQuantsClient } from "./jquants";
import { TwelveDataClient } from "./twelveData";
import type {
  CompanyInfo,
  StockData,
  ChartDataPoint,
  FinancialData,
  FastSearchResult,
  MarketDataClient,
  NewsItem,
} from "./marketDataTypes";

/** 4桁コードを含む → 日本株。それ以外（米国ティッカー）→ 米国株 */
export function isJpCode(symbolOrQuery: string): boolean {
  const norm = String(symbolOrQuery).normalize("NFKC");
  return Boolean(norm.match(/\d{4}/)?.[0]);
}

export class MarketDataRouter implements MarketDataClient {
  private jp = new JQuantsClient();
  private us = new TwelveDataClient();
  private pick(s: string): MarketDataClient {
    return isJpCode(s) ? this.jp : this.us;
  }

  getFastSearchResult(q: string, w?: string): Promise<FastSearchResult | null> {
    return this.pick(q).getFastSearchResult(q, w);
  }
  searchCompany(q: string): Promise<CompanyInfo | null> {
    return this.pick(q).searchCompany(q);
  }
  searchCompanyByGoogle(q: string): Promise<CompanyInfo | null> {
    return this.pick(q).searchCompanyByGoogle(q);
  }
  getStockData(s: string): Promise<StockData | null> {
    return this.pick(s).getStockData(s);
  }
  getChartData(s: string, w?: string): Promise<ChartDataPoint[]> {
    return this.pick(s).getChartData(s, w);
  }
  getFinancialData(s: string): Promise<FinancialData | null> {
    return this.pick(s).getFinancialData(s);
  }
  getCompanyNews(s: string, l?: number): Promise<NewsItem[]> {
    return this.pick(s).getCompanyNews(s, l);
  }
  getCompanyNewsFromGoogle(
    s: string,
    c: string,
    l?: number
  ): Promise<NewsItem[]> {
    return this.pick(s).getCompanyNewsFromGoogle(s, c, l);
  }
}
