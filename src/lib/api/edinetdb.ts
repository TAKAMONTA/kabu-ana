const EDINETDB_BASE_URL = "https://edinetdb.jp/v1";

// ---- 型定義 ----

export interface EdinetCompany {
  edinet_code: string;
  name: string;
  name_en?: string;
  sec_code?: string; // 証券コード（4桁）
  industry?: string;
  industry_slug?: string;
  market?: string;
}

export interface EdinetCompanyDetail extends EdinetCompany {
  address?: string;
  fiscal_month?: number;
  accounting_standard?: string; // "JP GAAP" | "IFRS" | "US GAAP"
}

export interface EdinetFinancials {
  fiscal_year: number;
  accounting_standard?: string;
  // PL
  revenue?: number;
  cost_of_sales?: number;
  gross_profit?: number;
  sga?: number;
  operating_income?: number;
  ordinary_income?: number;
  net_income?: number;
  depreciation?: number;
  rnd_expenses?: number;
  // BS
  total_assets?: number;
  current_assets?: number;
  noncurrent_assets?: number;
  inventories?: number;
  trade_receivables?: number;
  cash?: number;
  total_liabilities?: number;
  current_liabilities?: number;
  noncurrent_liabilities?: number;
  short_term_loans?: number;
  long_term_loans?: number;
  net_assets?: number;
  retained_earnings?: number;
  shareholders_equity?: number;
  // CF
  cf_operating?: number;
  cf_investing?: number;
  cf_financing?: number;
  capex?: number;
  // Per-share
  eps?: number;
  diluted_eps?: number;
  bps?: number;
  dividend_per_share?: number;
  per?: number;
  payout_ratio?: number;
  // Other
  roe_official?: number;
  equity_ratio_official?: number;
  num_employees?: number;
  shares_issued?: number;
}

export interface EdinetRatios {
  fiscal_year?: number;
  // 収益性
  gross_margin?: number;
  operating_margin?: number;
  net_margin?: number;
  sga_ratio?: number;
  rnd_ratio?: number;
  ebitda?: number;
  // 資本効率
  roe?: number;
  roa?: number;
  asset_turnover?: number;
  equity_ratio?: number;
  current_ratio?: number;
  interest_bearing_debt?: number;
  de_ratio?: number;
  net_debt?: number;
  fcf?: number;
  // 成長性（YoY）
  revenue_growth?: number;
  oi_growth?: number;
  ni_growth?: number;
  eps_growth?: number;
  // 成長性（CAGR 3年）
  revenue_cagr_3y?: number;
  oi_cagr_3y?: number;
  ni_cagr_3y?: number;
  eps_cagr_3y?: number;
  // 株主還元
  dividend_yield?: number;
  // 生産性
  revenue_per_employee?: number;
  net_income_per_employee?: number;
  capex_to_depreciation?: number;
}

export interface EdinetAnalysis {
  credit_score?: number;
  credit_rating?: string;
  summary?: string;
  strengths?: string[];
  risks?: string[];
  [key: string]: unknown;
}

export interface EdinetTextBlock {
  section?: string;
  title?: string;
  content?: string;
}

export interface EdinetRankingItem {
  edinet_code: string;
  name: string;
  sec_code?: string;
  value: number;
  industry?: string;
}

export interface EdinetIndustry {
  slug: string;
  name: string;
  company_count?: number;
}

// ---- クライアント ----

export class EdinetDBClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private get headers() {
    return {
      "X-API-Key": this.apiKey,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(path: string, params?: Record<string, string | number>): Promise<T | null> {
    try {
      const url = new URL(`${EDINETDB_BASE_URL}${path}`);
      if (params) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
      }
      const res = await fetch(url.toString(), { headers: this.headers });
      if (!res.ok) {
        const text = await res.text();
        console.error(`EDINET DB APIエラー [${path}] ${res.status}:`, text.substring(0, 200));
        return null;
      }
      return (await res.json()) as T;
    } catch (error: any) {
      console.error(`EDINET DB リクエストエラー [${path}]:`, error.message);
      return null;
    }
  }

  /** 企業検索 */
  async searchCompanies(query: string, limit = 10): Promise<EdinetCompany[]> {
    const data = await this.request<{ data: EdinetCompany[] }>("/search", { q: query, per_page: limit });
    return data?.data ?? [];
  }

  /** 企業詳細 */
  async getCompany(edinetCode: string): Promise<EdinetCompanyDetail | null> {
    const data = await this.request<{ data: EdinetCompanyDetail }>(`/companies/${edinetCode}`);
    return data?.data ?? null;
  }

  /** 財務時系列（最大6年分） */
  async getFinancials(edinetCode: string): Promise<EdinetFinancials[]> {
    const data = await this.request<{ data: EdinetFinancials[] }>(`/companies/${edinetCode}/financials`);
    return data?.data ?? [];
  }

  /** 計算済み財務指標（時系列配列の最新年度を返す） */
  async getRatios(edinetCode: string): Promise<EdinetRatios | null> {
    const data = await this.request<{ data: EdinetRatios | EdinetRatios[] }>(`/companies/${edinetCode}/ratios`);
    if (!data?.data) return null;
    if (Array.isArray(data.data)) {
      // 最新年度（fiscal_year が最大）を返す
      const sorted = [...data.data].sort((a, b) => (b.fiscal_year ?? 0) - (a.fiscal_year ?? 0));
      return sorted[0] ?? null;
    }
    return data.data;
  }

  /** AI財務健全性スコア */
  async getAnalysis(edinetCode: string): Promise<EdinetAnalysis | null> {
    const data = await this.request<{ data: EdinetAnalysis }>(`/companies/${edinetCode}/analysis`);
    return data?.data ?? null;
  }

  /** 有報テキストブロック */
  async getTextBlocks(edinetCode: string): Promise<EdinetTextBlock[]> {
    const data = await this.request<{ data: EdinetTextBlock[] }>(`/companies/${edinetCode}/text-blocks`);
    return data?.data ?? [];
  }

  /** ランキング */
  async getRanking(metric: string, limit = 20): Promise<EdinetRankingItem[]> {
    const data = await this.request<{ data: EdinetRankingItem[] }>(`/rankings/${metric}`, { limit });
    return data?.data ?? [];
  }

  /** 業種一覧 */
  async getIndustries(): Promise<EdinetIndustry[]> {
    const data = await this.request<{ data: EdinetIndustry[] }>("/industries");
    return data?.data ?? [];
  }

  /** 業種別企業一覧 */
  async getIndustry(slug: string): Promise<{ industry: EdinetIndustry; companies: EdinetCompany[] } | null> {
    const data = await this.request<{ data: { industry: EdinetIndustry; companies: EdinetCompany[] } }>(`/industries/${slug}`);
    return data?.data ?? null;
  }
}

/** 証券コード（4桁）から FMP シンボルへの変換（東証: XXXX.T） */
export function secCodeToFmpSymbol(secCode: string): string | null {
  // 末尾の "0" を除いた純数字4桁のみ対応（例: "72030" → "7203", "330A0" → null）
  const pure = secCode.replace(/0$/, ""); // 末尾の0を除去（5桁→4桁）
  if (/^\d{4}$/.test(pure)) {
    return `${pure}.T`;
  }
  // 5桁の場合は末尾を除去
  const digits = secCode.replace(/\D/g, "");
  if (digits.length >= 4) {
    return `${digits.slice(0, 4)}.T`;
  }
  return null;
}

/** クエリが日本企業（EDINET DB 検索対象）かどうかを事前判定 */
export function isJapaneseQuery(query: string): boolean {
  // 4桁の数字は日本の証券コード
  if (/^\d{4}$/.test(query.trim())) return true;
  // 日本語文字（ひらがな・カタカナ・漢字）を含む
  if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(query)) return true;
  return false;
}
