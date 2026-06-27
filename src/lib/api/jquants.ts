import { FreeNewsClient } from "./freeNews";
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

const BASE = "https://api.jquants.com/v2";

/** 4桁コード → J-Quants 5桁コード（末尾0付与）。5桁はそのまま */
export function toJQuantsCode(code: string): string {
  const c = String(code).trim();
  return /^\d{4}$/.test(c) ? `${c}0` : c;
}

/** 入力から4桁証券コードを抽出（無ければ元文字列） */
function extract4(code: string): string {
  return String(code).normalize("NFKC").match(/\d{4}/)?.[0] ?? String(code).trim();
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const toStr = (v: unknown): string | undefined =>
  v === null || v === undefined ? undefined : String(v);

/** アプリ window → 取得開始日(YYYY-MM-DD) */
function jFrom(window: string = "1M"): string {
  const day = 86_400_000;
  const back: Record<string, number> = {
    "1D": 5,
    "5D": 10,
    "1M": 31,
    "6M": 183,
    "1Y": 365,
    "5Y": 5 * 365,
    MAX: 20 * 365,
  };
  return new Date(Date.now() - (back[window] ?? 31) * day).toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

export class JQuantsClient implements MarketDataClient {
  private freeNews = new FreeNewsClient();
  constructor(private apiKey: string = process.env.JQUANTS_API_KEY ?? "") {}

  /** data 配列を返す。pagination_key があれば連結 */
  private async getData(path: string): Promise<any[]> {
    let url = `${BASE}${path}`;
    const out: any[] = [];
    for (let i = 0; i < 10; i++) {
      let res: Response | null = null;
      try {
        res = await fetch(url, { headers: { "x-api-key": this.apiKey } });
      } catch {
        break;
      }
      const body = await res.json().catch(() => ({}));
      if (Array.isArray(body?.data)) out.push(...body.data);
      if (!body?.pagination_key) break;
      const sep = path.includes("?") ? "&" : "?";
      url = `${BASE}${path}${sep}pagination_key=${encodeURIComponent(body.pagination_key)}`;
    }
    return out;
  }

  async searchCompany(query: string): Promise<CompanyInfo | null> {
    const code4 = extract4(query);
    const rows = await this.getData(`/equities/master?code=${toJQuantsCode(code4)}`);
    const m = rows[0];
    if (!m) return null;
    const jpx = JPX_STOCK_BY_CODE.get(code4);
    return {
      name: m.CoName ?? jpx?.name ?? query,
      symbol: code4,
      market: jpx?.marketSegment ?? "東証",
      description: m.S33Nm ?? jpx?.sector33 ?? "",
    };
  }

  async searchCompanyByGoogle(query: string): Promise<CompanyInfo | null> {
    return this.searchCompany(query);
  }

  /** bars/daily を昇順で取得（getStockData/getChartData 共用） */
  private async bars(code4: string, window: string): Promise<any[]> {
    const rows = await this.getData(
      `/equities/bars/daily?code=${toJQuantsCode(code4)}&from=${jFrom(window)}&to=${today()}`
    );
    return rows.filter((r: any) => r && r.Date).sort((a: any, b: any) => (a.Date < b.Date ? -1 : 1));
  }

  async getStockData(symbol: string): Promise<StockData | null> {
    const code4 = extract4(symbol);
    const rows = await this.bars(code4, "1Y");
    if (rows.length === 0) return null;
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2] ?? last;
    const price = num(last.C);
    const prevC = num(prev.C);
    const closes = rows.map((r: any) => num(r.C)).filter((n: number) => n > 0);
    return {
      symbol: code4,
      price,
      change: price - prevC,
      changePercent: prevC ? ((price - prevC) / prevC) * 100 : 0,
      volume: num(last.Vo),
      marketCap: "N/A",
      pe: 0,
      eps: 0,
      dividend: 0,
      high52: closes.length ? Math.max(...closes) : 0,
      low52: closes.length ? Math.min(...closes) : 0,
    };
  }

  async getChartData(symbol: string, window: string = "1M"): Promise<ChartDataPoint[]> {
    const rows = await this.bars(extract4(symbol), window);
    return rows.map((r: any) => ({
      date: r.Date,
      price: num(r.AdjC ?? r.C),
      volume: num(r.AdjVo ?? r.Vo),
    }));
  }

  async getFinancialData(symbol: string): Promise<FinancialData | null> {
    const rows = await this.getData(`/fins/summary?code=${toJQuantsCode(extract4(symbol))}`);
    const s = rows[rows.length - 1];
    if (!s) return null;
    return {
      revenue: toStr(s.Sales),
      operatingIncome: toStr(s.OP),
      netIncome: toStr(s.NP),
      eps: toStr(s.EPS),
      totalAssets: undefined,
      totalLiabilities: undefined,
      cash: undefined,
      period: s.CurPerEn ? `${String(s.CurPerEn).slice(0, 4)} (FY)` : undefined,
    };
  }

  async getCompanyNews(symbol: string, limit = 10): Promise<NewsItem[]> {
    const name = JPX_STOCK_BY_CODE.get(extract4(symbol))?.name ?? symbol;
    return this.freeNews.getComprehensiveNews(name, symbol, limit);
  }

  async getCompanyNewsFromGoogle(_symbol: string, companyName: string, limit = 10): Promise<NewsItem[]> {
    return this.freeNews.getComprehensiveNews(companyName, undefined, limit);
  }

  async getFastSearchResult(query: string, window = "1M"): Promise<FastSearchResult | null> {
    const [companyInfo, stockData, chartData, financialData, newsData] = await Promise.all([
      this.searchCompany(query),
      this.getStockData(query),
      this.getChartData(query, window),
      this.getFinancialData(query),
      this.getCompanyNews(query, 5),
    ]);
    if (!companyInfo || !stockData) return null;
    return {
      companyInfo: {
        ...companyInfo,
        price: stockData.price,
        change: stockData.change,
        changePercent: stockData.changePercent,
      },
      stockData,
      newsData,
      chartData,
      financialData,
    };
  }
}
