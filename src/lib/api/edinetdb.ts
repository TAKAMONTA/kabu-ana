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

type EdinetEnvelope<T> = {
  data?: T | null;
  [key: string]: unknown;
};

/** EDINET検索用の証券コードを、アプリ内の株式シンボル表現から抽出する */
export function getEdinetSearchQueryFromSymbol(
  symbol?: string | null,
  market?: string | null
): string | null {
  const normalizedSymbol = symbol?.trim().toUpperCase();
  if (!normalizedSymbol) return null;

  const secCode = normalizedSymbol.match(/^([0-9A-Z]{4})(?:\.T)?$/)?.[1];
  if (!secCode) return null;

  const normalizedMarket = market?.trim().toUpperCase();
  const isTokyoStock =
    normalizedSymbol.endsWith(".T") ||
    normalizedMarket === "TYO" ||
    normalizedMarket === "TSE" ||
    normalizedMarket === "TOKYO";

  return isTokyoStock ? secCode : null;
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

  private async request<T>(
    path: string,
    params?: Record<string, string | number>
  ): Promise<T | null> {
    try {
      const url = new URL(`${EDINETDB_BASE_URL}${path}`);
      if (params) {
        Object.entries(params).forEach(([k, v]) =>
          url.searchParams.set(k, String(v))
        );
      }
      const res = await fetch(url.toString(), { headers: this.headers });
      if (!res.ok) {
        const text = await res.text();
        console.error(
          `EDINET DB APIエラー [${path}] ${res.status}:`,
          text.substring(0, 200)
        );
        return null;
      }
      return (await res.json()) as T;
    } catch (error: any) {
      console.error(`EDINET DB リクエストエラー [${path}]:`, error.message);
      return null;
    }
  }

  private readDataEnvelope<T>(
    path: string,
    response: EdinetEnvelope<T> | null
  ): T | null {
    if (!response) return null;
    if (Object.prototype.hasOwnProperty.call(response, "data")) {
      return response.data ?? null;
    }

    console.error("EDINET DB レスポンス形式エラー:", {
      path,
      keys: Object.keys(response).slice(0, 10),
    });
    return null;
  }

  /** 企業検索 */
  async searchCompanies(query: string, limit = 10): Promise<EdinetCompany[]> {
    const path = "/search";
    const response = await this.request<EdinetEnvelope<EdinetCompany[]>>(path, {
      q: query,
      per_page: limit,
    });
    return this.readDataEnvelope(path, response) ?? [];
  }

  /** 企業詳細 */
  async getCompany(edinetCode: string): Promise<EdinetCompanyDetail | null> {
    const path = `/companies/${edinetCode}`;
    const response =
      await this.request<EdinetEnvelope<EdinetCompanyDetail>>(path);
    return this.readDataEnvelope(path, response);
  }

  /** 財務時系列（最大6年分） */
  async getFinancials(edinetCode: string): Promise<EdinetFinancials[]> {
    const path = `/companies/${edinetCode}/financials`;
    const response =
      await this.request<EdinetEnvelope<EdinetFinancials[]>>(path);
    return this.readDataEnvelope(path, response) ?? [];
  }

  /** 計算済み財務指標（時系列配列の最新年度を返す） */
  async getRatios(edinetCode: string): Promise<EdinetRatios | null> {
    const path = `/companies/${edinetCode}/ratios`;
    const response =
      await this.request<EdinetEnvelope<EdinetRatios | EdinetRatios[]>>(path);
    const data = this.readDataEnvelope(path, response);
    if (!data) return null;
    if (Array.isArray(data)) {
      // 最新年度（fiscal_year が最大）を返す
      const sorted = [...data].sort(
        (a, b) => (b.fiscal_year ?? 0) - (a.fiscal_year ?? 0)
      );
      return sorted[0] ?? null;
    }
    return data;
  }

  /** AI財務健全性スコア */
  async getAnalysis(edinetCode: string): Promise<EdinetAnalysis | null> {
    const path = `/companies/${edinetCode}/analysis`;
    const response = await this.request<EdinetEnvelope<EdinetAnalysis>>(path);
    return this.readDataEnvelope(path, response);
  }

  /** 有報テキストブロック */
  async getTextBlocks(edinetCode: string): Promise<EdinetTextBlock[]> {
    const path = `/companies/${edinetCode}/text-blocks`;
    const response =
      await this.request<EdinetEnvelope<EdinetTextBlock[]>>(path);
    return this.readDataEnvelope(path, response) ?? [];
  }

  /** ランキング */
  async getRanking(metric: string, limit = 20): Promise<EdinetRankingItem[]> {
    const path = `/rankings/${metric}`;
    const response = await this.request<EdinetEnvelope<EdinetRankingItem[]>>(
      path,
      { limit }
    );
    return this.readDataEnvelope(path, response) ?? [];
  }

  /** 業種一覧 */
  async getIndustries(): Promise<EdinetIndustry[]> {
    const path = "/industries";
    const response = await this.request<EdinetEnvelope<EdinetIndustry[]>>(path);
    return this.readDataEnvelope(path, response) ?? [];
  }

  /** 業種別企業一覧 */
  async getIndustry(
    slug: string
  ): Promise<{ industry: EdinetIndustry; companies: EdinetCompany[] } | null> {
    const path = `/industries/${slug}`;
    const response =
      await this.request<
        EdinetEnvelope<{ industry: EdinetIndustry; companies: EdinetCompany[] }>
      >(path);
    return this.readDataEnvelope(path, response);
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
