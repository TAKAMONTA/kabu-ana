import { FreeNewsClient } from "./freeNews";
import type {
  CompanyInfo, StockData, ChartDataPoint, FinancialData, FastSearchResult,
  MarketDataClient, NewsItem,
} from "./marketDataTypes";

const BASE = "https://api.twelvedata.com";

/** アプリの window 値 → Twelve Data {interval, outputsize} */
export function tdWindow(window: string = "1M"): { interval: string; outputsize: number } {
  const table: Record<string, { interval: string; outputsize: number }> = {
    "1D": { interval: "5min", outputsize: 78 },
    "5D": { interval: "30min", outputsize: 65 },
    "1M": { interval: "1day", outputsize: 23 },
    "6M": { interval: "1day", outputsize: 130 },
    "1Y": { interval: "1day", outputsize: 252 },
    "5Y": { interval: "1week", outputsize: 260 },
    MAX: { interval: "1month", outputsize: 240 },
  };
  return table[window] ?? table["1M"];
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export class TwelveDataClient implements MarketDataClient {
  private freeNews = new FreeNewsClient();
  constructor(private apiKey: string = process.env.TWELVE_DATA_API_KEY ?? "") {}

  private async get(path: string): Promise<any> {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${BASE}${path}${sep}apikey=${this.apiKey}`).catch(() => null);
    if (!res) return null;
    const body = await res.json().catch(() => ({}));
    if (body && (body.status === "error" || Number(body.code) >= 400)) return null;
    return body;
  }

  async getStockData(symbol: string): Promise<StockData | null> {
    const q = await this.get(`/quote?symbol=${encodeURIComponent(symbol)}`);
    if (!q || !q.close) return null;
    const fw = q.fifty_two_week ?? {};
    return {
      symbol: q.symbol ?? symbol,
      price: num(q.close),
      change: num(q.change),
      changePercent: num(q.percent_change),
      volume: num(q.volume),
      marketCap: "N/A",
      pe: 0,
      eps: 0,
      dividend: 0,
      high52: num(fw.high),
      low52: num(fw.low),
    };
  }

  async searchCompany(query: string): Promise<CompanyInfo | null> {
    const q = await this.get(`/quote?symbol=${encodeURIComponent(query)}`);
    if (!q || !q.symbol) return null;
    return {
      name: q.name ?? query,
      symbol: q.symbol,
      market: q.exchange ?? "",
      price: num(q.close),
      change: num(q.change),
      changePercent: num(q.percent_change),
    };
  }

  async searchCompanyByGoogle(query: string): Promise<CompanyInfo | null> {
    return this.searchCompany(query);
  }

  async getChartData(symbol: string, window: string = "1M"): Promise<ChartDataPoint[]> {
    const { interval, outputsize } = tdWindow(window);
    const d = await this.get(
      `/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}&order=ASC`
    );
    const values: any[] = d?.values ?? [];
    return values
      .filter(v => v && v.datetime)
      .map(v => ({ date: v.datetime, price: num(v.close), volume: num(v.volume) }));
  }

  async getFinancialData(_symbol: string): Promise<FinancialData | null> {
    return null;
  }

  async getCompanyNews(symbol: string, limit = 10): Promise<NewsItem[]> {
    return this.freeNews.getComprehensiveNews(symbol, symbol, limit);
  }

  async getCompanyNewsFromGoogle(_symbol: string, companyName: string, limit = 10): Promise<NewsItem[]> {
    return this.freeNews.getComprehensiveNews(companyName, undefined, limit);
  }

  async getFastSearchResult(query: string, window = "1M"): Promise<FastSearchResult | null> {
    const [companyInfo, stockData, chartData, newsData] = await Promise.all([
      this.searchCompany(query),
      this.getStockData(query),
      this.getChartData(query, window),
      this.getCompanyNews(query, 5),
    ]);
    if (!companyInfo || !stockData) return null;
    return {
      companyInfo: { ...companyInfo, price: stockData.price, change: stockData.change, changePercent: stockData.changePercent },
      stockData,
      newsData,
      chartData,
      financialData: null,
    };
  }
}
