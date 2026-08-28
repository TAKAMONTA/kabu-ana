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

/**
 * 4文字（先頭が数字・残りは数字または英大文字）のコードを含む → 日本株。
 * それ以外（米国ティッカーなど）→ 米国株。
 * 例: 7203（4桁数字）、130A（グロース市場の英字入りコード）
 */
const JP_CODE_PATTERN = /(^|[^A-Z0-9])\d[\dA-Z]{3}([^A-Z0-9]|$)/;

export function isJpCode(symbolOrQuery: string): boolean {
  const norm = String(symbolOrQuery).normalize("NFKC").trim().toUpperCase();
  return JP_CODE_PATTERN.test(norm);
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
  getCompanyNewsByName(
    s: string,
    c: string,
    l?: number
  ): Promise<NewsItem[]> {
    return this.pick(s).getCompanyNewsByName(s, c, l);
  }
}
