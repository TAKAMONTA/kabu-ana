import { FreeNewsClient } from "./freeNews";
import { JPX_STOCK_BY_CODE } from "@/lib/jpx/stockMaster";
import { normalizeDisplayText } from "@/lib/displayText";
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
/** 1リクエストあたりのタイムアウト（ページングの各ページに適用） */
export const JQUANTS_FETCH_TIMEOUT_MS = 10_000;

/** 4桁コード → J-Quants 5桁コード（末尾0付与）。5桁はそのまま */
export function toJQuantsCode(code: string): string {
  const c = String(code).trim();
  return /^\d{4}$/.test(c) ? `${c}0` : c;
}

/** 入力から4桁証券コードを抽出（無ければ元文字列） */
function extract4(code: string): string {
  return (
    String(code).normalize("NFKC").match(/\d{4}/)?.[0] ?? String(code).trim()
  );
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
    "1W": 10,
    "1M": 31,
    "3M": 92,
    "6M": 183,
    "1Y": 365,
    "5Y": 5 * 365,
    MAX: 20 * 365,
  };
  return new Date(Date.now() - (back[window] ?? 31) * day)
    .toISOString()
    .slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

/**
 * /fins/summary の行から表示に使う1行を選ぶ。
 * 行には四半期決算（CurPerType: 1Q〜3Q）や業績予想の修正（売上が空）も混ざるため、
 * 末尾の行を「通期」と決めつけず、売上のある通期（FY）の最新行を優先する。
 * 通期が1件も無ければ、売上のある最新行（期間の種類はそのまま表示する）。
 */
export function selectLatestFinancialRow(rows: any[]): any | null {
  const withSales = rows.filter(
    (r: any) => r && r.Sales !== undefined && r.Sales !== null && r.Sales !== ""
  );
  const byDate = (r: any) => String(r.DiscDate ?? r.CurPerEn ?? "");
  const latest = (list: any[]) =>
    list.reduce<any | null>(
      (best, row) => (!best || byDate(row) >= byDate(best) ? row : best),
      null
    );
  return (
    latest(withSales.filter((r: any) => r.CurPerType === "FY")) ??
    latest(withSales) ??
    null
  );
}

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
        res = await fetch(url, {
          headers: { "x-api-key": this.apiKey },
          signal: AbortSignal.timeout(JQUANTS_FETCH_TIMEOUT_MS),
        });
      } catch (error) {
        console.warn(
          `J-Quants 取得失敗 [${path.split("?")[0]}]:`,
          error instanceof Error ? error.name : "unknown"
        );
        break;
      }
      if (!res.ok) {
        // 401（キー不正）や 429（上限）の本文を data として読まない
        console.warn(
          `J-Quants エラー応答 [${path.split("?")[0]}]: status=${res.status}`
        );
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
    const rows = await this.getData(
      `/equities/master?code=${encodeURIComponent(toJQuantsCode(code4))}`
    );
    const m = rows[0];
    if (!m) return null;
    const jpx = JPX_STOCK_BY_CODE.get(code4);
    // ETF・ETN / REIT は J-Quants の CoName が「<運用会社名>　<ファンド名>」形式
    // （例:「野村アセットマネジメント株式会社　ＮＥＸＴ　ＦＵＮＤＳ　ＴＯＰＩＸ
    // 連動型上場投信」）で、UIに出すと冗長。ローカルマスタは JPX 公式の
    // ファンド名のみを持つのでそちらを表示名に使う。マスタの表示名は全角の
    // ままJPXから来るため、UI表示・ニュース検索語としては normalizeDisplayText
    // （NFKC + 空白畳み）で半角に正規化してから使う。
    // 個別株(equity)は従来どおり CoName を優先し、表示を一切変えない。
    // マスタ未収録コード（jpx === undefined）も従来どおり CoName へフォールバック。
    const preferLocalName = jpx !== undefined && jpx.assetType !== "equity";
    return {
      name: preferLocalName
        ? normalizeDisplayText(jpx.name)
        : (m.CoName ?? jpx?.name ?? query),
      symbol: code4,
      market: jpx?.marketSegment ?? "東証",
      description: m.S33Nm ?? jpx?.sector33 ?? "",
    };
  }

  /** bars/daily を昇順で取得（getStockData/getChartData 共用） */
  private async bars(code4: string, window: string): Promise<any[]> {
    const rows = await this.getData(
      `/equities/bars/daily?code=${encodeURIComponent(toJQuantsCode(code4))}&from=${jFrom(window)}&to=${today()}`
    );
    return rows
      .filter((r: any) => r && r.Date)
      .sort((a: any, b: any) => (a.Date < b.Date ? -1 : 1));
  }

  async getStockData(symbol: string): Promise<StockData | null> {
    const code4 = extract4(symbol);
    const rows = await this.bars(code4, "1Y");
    if (rows.length === 0) return null;
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2] ?? last;
    // 表示する株価は実際の終値（C）。前日比・52週高安値は株式分割等を考慮した
    // 調整後終値（AdjC）で計算する（チャートと同じ系列。生の C だと分割日に
    // 前日比が -50% のように見える）。AdjC が無ければ C を使う。
    const adjClose = (r: any) => num(r.AdjC ?? r.C);
    const price = num(last.C);
    const lastAdj = adjClose(last);
    const prevAdj = adjClose(prev);
    const closes = rows.map(adjClose).filter((n: number) => n > 0);
    return {
      symbol: code4,
      price,
      change: lastAdj - prevAdj,
      changePercent: prevAdj ? ((lastAdj - prevAdj) / prevAdj) * 100 : 0,
      volume: num(last.Vo),
      marketCap: "N/A",
      pe: 0,
      eps: 0,
      dividend: 0,
      high52: closes.length ? Math.max(...closes) : 0,
      low52: closes.length ? Math.min(...closes) : 0,
      asOf: typeof last.Date === "string" ? last.Date : undefined,
    };
  }

  async getChartData(
    symbol: string,
    window: string = "1M"
  ): Promise<ChartDataPoint[]> {
    const rows = await this.bars(extract4(symbol), window);
    return rows.map((r: any) => ({
      date: r.Date,
      price: num(r.AdjC ?? r.C),
      volume: num(r.AdjVo ?? r.Vo),
    }));
  }

  async getFinancialData(symbol: string): Promise<FinancialData | null> {
    const rows = await this.getData(
      `/fins/summary?code=${encodeURIComponent(toJQuantsCode(extract4(symbol)))}`
    );
    const s = selectLatestFinancialRow(rows);
    if (!s) return null;
    return {
      revenue: toStr(s.Sales),
      operatingIncome: toStr(s.OP),
      netIncome: toStr(s.NP),
      eps: toStr(s.EPS),
      totalAssets: undefined,
      totalLiabilities: undefined,
      cash: undefined,
      // 期間の種類（FY / 1Q〜3Q 等）は CurPerType の実際の値を表示する
      period: s.CurPerEn
        ? `${String(s.CurPerEn).slice(0, 4)} (${s.CurPerType || "FY"})`
        : undefined,
    };
  }

  async getCompanyNews(symbol: string, limit = 10): Promise<NewsItem[]> {
    const code4 = extract4(symbol);
    // ETF・ETN / REIT の正式名称はマスタ上は全角のままなので、ニュース検索語に
    // 使う前に normalizeDisplayText で半角へ正規化する。関連度フィルタ自体は
    // 全角/半角どちらの表記でも一致するようになったが、Google News RSS など
    // 外部検索エンジンに投げるクエリとしては半角表記の方がヒットしやすいため、
    // 検索語の品質向上を目的に正規化して渡す。
    // 個別株(equity)は従来どおりマスタの表示名をそのまま使う。
    const jpx = JPX_STOCK_BY_CODE.get(code4);
    const name = jpx
      ? jpx.assetType === "equity"
        ? jpx.name
        : normalizeDisplayText(jpx.name)
      : symbol;
    return this.freeNews.getComprehensiveNews(name, symbol, limit);
  }

  /**
   * symbol を渡さず企業名（companyName）だけで検索する。Yahoo Finance 経路
   * （FreeNewsClient は symbol 有りの場合のみ Yahoo を叩く）をスキップするため、
   * 実質的に Google News RSS のみで検索する。
   */
  async getCompanyNewsByName(
    _symbol: string,
    companyName: string,
    limit = 10
  ): Promise<NewsItem[]> {
    return this.freeNews.getComprehensiveNews(companyName, undefined, limit);
  }

  async getFastSearchResult(
    query: string,
    window = "1M"
  ): Promise<FastSearchResult | null> {
    const [companyInfo, stockData, chartData, financialData, newsData] =
      await Promise.all([
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
