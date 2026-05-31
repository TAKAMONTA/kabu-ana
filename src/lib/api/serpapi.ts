import axios from "axios";
import { normalizeQuery, toHalfWidth } from "@/lib/utils/textUtils";

const SERPAPI_BASE_URL = "https://serpapi.com/search";

export interface CompanyInfo {
  name: string;
  symbol: string;
  market: string;
  price?: number;
  change?: number;
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

export interface FastSearchResult {
  companyInfo: CompanyInfo;
  stockData: StockData;
  newsData: any[];
  chartData: ChartDataPoint[];
  financialData: FinancialData | null;
}

export class SerpApiClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private googleFinanceCache = new Map<string, Promise<any>>();

  private formatCompanySearchQuery(query: string): string {
    return this.formatCompanySearchQueries(query)[0];
  }

  private formatCompanySearchQueries(query: string): string[] {
    const half = toHalfWidth(query).trim();
    if (half.includes(":")) return [half.toUpperCase()];

    const compactUpper = half.replace(/\s+/g, "").toUpperCase();
    const isFourDigitJapaneseCode = /^\d{4}$/.test(compactUpper);
    const isLikelyTicker = /^[A-Z.]+$/.test(compactUpper);

    if (isFourDigitJapaneseCode) return [compactUpper + ":TYO"];
    if (isLikelyTicker) {
      return [
        compactUpper + ":NASDAQ",
        compactUpper + ":NYSE",
        compactUpper + ":NYSEARCA",
      ];
    }
    return [half.toUpperCase()];
  }

  private formatSymbolQuery(symbol: string): string {
    const formattedQuery = normalizeQuery(symbol).toUpperCase();
    if (formattedQuery.includes(":")) return formattedQuery;
    return /^\d{4}$/.test(formattedQuery)
      ? formattedQuery + ":TYO"
      : formattedQuery + ":NASDAQ";
  }

  private async getGoogleFinanceData(
    formattedQuery: string,
    extraParams: Record<string, string> = {},
    options: { timeoutMs?: number } = {}
  ): Promise<any> {
    const params = {
      engine: "google_finance",
      q: formattedQuery,
      api_key: this.apiKey,
      hl: "ja",
      ...extraParams,
    };
    const cacheKey = JSON.stringify({
      params,
      timeoutMs: options.timeoutMs || 0,
    });
    const cached = this.googleFinanceCache.get(cacheKey);
    if (cached) return cached;

    const request = axios
      .get(SERPAPI_BASE_URL, {
        params,
        timeout: options.timeoutMs,
      })
      .then(response => response.data)
      .catch(error => {
        this.googleFinanceCache.delete(cacheKey);
        throw error;
      });
    this.googleFinanceCache.set(cacheKey, request);
    return request;
  }

  private buildCompanyInfo(data: any, fallbackQuery: string): CompanyInfo | null {
    if (!data?.summary) return null;

    const about = data.knowledge_graph?.about?.[0];
    return {
      name: data.summary.title || "",
      symbol: data.summary.stock || fallbackQuery,
      market: data.summary.exchange || "",
      price: data.summary.extracted_price || 0,
      change: data.summary.price_movement?.value || 0,
      changePercent: (data.summary.price_movement?.percentage || 0) * 100,
      description: about?.description?.snippet || "",
      website: "",
      employees: "",
      founded: "",
      headquarters: "",
    };
  }

  private buildStockData(data: any, symbol: string): StockData | null {
    if (!data?.summary) return null;

    const stats = data.knowledge_graph?.key_stats?.stats || [];

    const getStatValue = (...labels: string[]) => {
      for (const label of labels) {
        const stat = stats.find((s: any) => s.label === label);
        if (stat?.value) {
          return stat.value;
        }
      }
      return "";
    };

    const avgVolumeStr = getStatValue(
      "平均出来高",
      "Avg Volume",
      "平均取引高"
    );
    let volume = 0;
    if (avgVolumeStr) {
      const match = avgVolumeStr.match(/([\d,.]+)([MK万億百千]?)/);
      if (match) {
        const value = parseFloat(match[1].replace(/,/g, ""));
        const unit = match[2];
        if (unit === "M" || unit === "百万") volume = value * 1000000;
        else if (unit === "K" || unit === "千") volume = value * 1000;
        else if (unit === "万") volume = value * 10000;
        else if (unit === "億") volume = value * 100000000;
        else volume = value;
      }
    }

    const yearRange = getStatValue(
      "52 週の範囲",
      "Year range",
      "52週範囲",
      "52週の範囲"
    );
    const yearRangeParts = yearRange
      .replace(/[¥$,円]/g, "")
      .trim()
      .split(/\s*-\s*/);

    const marketCapStr = getStatValue("時価総額", "Market cap");
    const peStr = getStatValue(
      "株価収益率",
      "P/E ratio",
      "PER",
      "株価純資産倍率",
      "PBR"
    );
    const dividendStr = getStatValue(
      "配当利回り",
      "Dividend yield",
      "配当"
    );

    return {
      symbol: data.summary.stock || symbol,
      price: data.summary.extracted_price || 0,
      change: data.summary.price_movement?.value || 0,
      changePercent: (data.summary.price_movement?.percentage || 0) * 100,
      volume,
      marketCap: marketCapStr || "N/A",
      pe: parseFloat(peStr.replace(/[^0-9.-]/g, "")) || 0,
      eps: 0,
      dividend: parseFloat(dividendStr.replace(/[%％]/g, "")) || 0,
      high52: parseFloat(yearRangeParts[1]) || 0,
      low52: parseFloat(yearRangeParts[0]) || 0,
    };
  }

  private buildNewsData(data: any, limit: number = 10): any[] {
    const newsResults = data?.news_results || [];
    const news = newsResults.flatMap((result: any) => result.items || []);

    return news
      .map((item: any) => ({
        title: item.title || item.snippet,
        snippet: item.snippet || item.title,
        source: item.source || "Google Finance",
        date: item.date
          ? new Date(item.date).toLocaleDateString("ja-JP")
          : "不明",
        link: item.link,
      }))
      .slice(0, limit);
  }

  private buildChartData(data: any): ChartDataPoint[] {
    const graphData = data?.graph || [];

    return graphData.map((point: any) => {
      const dataPoint: ChartDataPoint = {
        date: point.date || "",
        price: point.price || 0,
        volume: point.volume || 0,
      };

      if (point.key_event) {
        dataPoint.keyEvent = {
          title: point.key_event.title,
          link: point.key_event.link,
          source: point.key_event.source,
        };
      }

      return dataPoint;
    });
  }

  private buildFinancialData(data: any): FinancialData | null {
    const financials = data?.financials || [];

    const incomeStatement = financials.find(
      (f: any) => f.title === "Income Statement" || f.title === "損益計算書"
    );
    const balanceSheet = financials.find(
      (f: any) => f.title === "Balance Sheet" || f.title === "貸借対照表"
    );

    if (!incomeStatement) {
      return null;
    }

    const latestPeriod = incomeStatement.results?.[0];
    const latestBalance = balanceSheet?.results?.[0];

    const getValue = (table: any[], ...titles: string[]) => {
      if (!table) return undefined;
      for (const title of titles) {
        const item = table.find((row: any) => row.title === title);
        if (item?.value) return item.value;
      }
      return undefined;
    };

    return {
      revenue: getValue(
        latestPeriod?.table || [],
        "Revenue",
        "売上高",
        "Total revenue"
      ),
      netIncome: getValue(
        latestPeriod?.table || [],
        "Net income",
        "純利益",
        "当期純利益"
      ),
      operatingIncome: getValue(
        latestPeriod?.table || [],
        "Operating income",
        "営業利益"
      ),
      totalAssets: getValue(
        latestBalance?.table || [],
        "Total assets",
        "総資産"
      ),
      totalLiabilities: getValue(
        latestBalance?.table || [],
        "Total liabilities",
        "総負債"
      ),
      cash: getValue(
        latestBalance?.table || [],
        "Cash and short-term investments",
        "現金及び現金同等物",
        "現金・預金"
      ),
      eps: getValue(
        latestPeriod?.table || [],
        "EPS",
        "Basic EPS",
        "Diluted EPS",
        "1株当たり利益"
      ),
      period: `${latestPeriod?.date || ""} (${
        latestPeriod?.period_type || ""
      })`,
    };
  }

  async getFastSearchResult(
    query: string,
    window: string = "1M"
  ): Promise<FastSearchResult | null> {
    const formattedQueries = this.formatCompanySearchQueries(query);
    let detailedDataPromise: Promise<any> | null = null;
    let chartWindowData: any = null;

    for (const formattedQuery of formattedQueries) {
      detailedDataPromise = this.getGoogleFinanceData(
        formattedQuery,
        {},
        { timeoutMs: 1800 }
      ).catch(() => null);
      chartWindowData = await this.getGoogleFinanceData(
        formattedQuery,
        { window },
        { timeoutMs: 3000 }
      ).catch(() => null);

      if (chartWindowData?.summary) {
        break;
      }
      detailedDataPromise = null;
    }

    const detailedData = detailedDataPromise ? await detailedDataPromise : null;
    const primaryData = detailedData || chartWindowData;
    const companyInfo = this.buildCompanyInfo(primaryData, query);
    if (!companyInfo) return null;

    const stockData =
      this.buildStockData(detailedData || chartWindowData, companyInfo.symbol) ||
      this.buildStockData(primaryData, companyInfo.symbol);
    if (!stockData) return null;

    return {
      companyInfo,
      stockData,
      newsData: detailedData ? this.buildNewsData(detailedData, 5) : [],
      chartData: this.buildChartData(chartWindowData || detailedData),
      financialData: detailedData ? this.buildFinancialData(detailedData) : null,
    };
  }

  async searchCompany(query: string): Promise<CompanyInfo | null> {
    try {
      const formattedQuery = this.formatCompanySearchQuery(query);
      const data = await this.getGoogleFinanceData(formattedQuery);

      // Google Finance APIのレスポンス構造に合わせて修正
      if (data.summary) {
        const about = data.knowledge_graph?.about?.[0];
        return {
          name: data.summary.title || "",
          symbol: data.summary.stock || query,
          market: data.summary.exchange || "",
          price: data.summary.extracted_price || 0,
          change: data.summary.price_movement?.value || 0,
          changePercent: (data.summary.price_movement?.percentage || 0) * 100,
          description: about?.description?.snippet || "",
          website: "",
          employees: "",
          founded: "",
          headquarters: "",
        };
      }

      return null;
    } catch (error: any) {
      console.error("SERPAPI検索エラー:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
      }
      return null;
    }
  }

  /**
   * Google 検索エンジンで企業名から会社情報を推定（フォールバック用）
   */
  async searchCompanyByGoogle(query: string): Promise<CompanyInfo | null> {
    try {
      const response = await axios.get(SERPAPI_BASE_URL, {
        params: {
          engine: "google",
          q: query,
          api_key: this.apiKey,
          hl: "ja",
          num: 5,
        },
      });

      const data = response.data || {};
      const kg = data.knowledge_graph || {};

      // knowledge_graph に株式情報があれば優先
      if (kg && (kg.title || kg.name)) {
        const title = kg.title || kg.name;
        const symbol = kg.stock || kg.ticker || "";
        const exchange = kg.exchange || "";
        if (symbol) {
          return {
            name: title,
            symbol,
            market: exchange,
          };
        }
      }

      // organic_results から Google Finance へのリンクを拾い、シンボルを推定
      const results = data.organic_results || [];
      for (const r of results) {
        const link: string = r.link || "";
        if (link.includes("google.com/finance")) {
          // 例: https://www.google.com/finance/quote/AAPL:NASDAQ
          const m = link.match(/quote\/([A-Z0-9.]+):([A-Z]+)/i);
          if (m) {
            return {
              name: r.title || query,
              symbol: m[1].toUpperCase(),
              market: m[2].toUpperCase(),
            };
          }
        }
      }

      // 追加の試行: Google Finance を優先するクエリで再検索
      const altQuery = `${query} 株価 site:google.com/finance`;
      const response2 = await axios.get(SERPAPI_BASE_URL, {
        params: {
          engine: "google",
          q: altQuery,
          api_key: this.apiKey,
          hl: "ja",
          num: 10,
        },
      });
      const org2 = response2.data?.organic_results || [];
      for (const r of org2) {
        const link: string = r.link || "";
        const m = link.match(/quote\/([A-Z0-9.]+):([A-Z]+)/i);
        if (m) {
          return {
            name: r.title || query,
            symbol: m[1].toUpperCase(),
            market: m[2].toUpperCase(),
          };
        }
      }

      return null;
    } catch (error: any) {
      console.error("SERPAPI Google名称検索エラー:", error.message);
      return null;
    }
  }

  async getStockData(symbol: string): Promise<StockData | null> {
    try {
      const formattedQuery = this.formatSymbolQuery(symbol);
      const data = await this.getGoogleFinanceData(formattedQuery);

      if (data.summary) {
        const stats = data.knowledge_graph?.key_stats?.stats || [];

        const getStatValue = (...labels: string[]) => {
          for (const label of labels) {
            const stat = stats.find((s: any) => s.label === label);
            if (stat?.value) {
              return stat.value;
            }
          }
          return "";
        };

        // ラベルは日本語と英語の両方に対応
        const avgVolumeStr = getStatValue(
          "平均出来高",
          "Avg Volume",
          "平均取引高"
        );
        let volume = 0;
        if (avgVolumeStr) {
          const match = avgVolumeStr.match(/([\d,.]+)([MK万億百千]?)/);
          if (match) {
            const value = parseFloat(match[1].replace(/,/g, ""));
            const unit = match[2];
            if (unit === "M" || unit === "百万") volume = value * 1000000;
            else if (unit === "K" || unit === "千") volume = value * 1000;
            else if (unit === "万") volume = value * 10000;
            else if (unit === "億") volume = value * 100000000;
            else volume = value;
          }
        }

        const yearRange = getStatValue(
          "52 週の範囲",
          "Year range",
          "52週範囲",
          "52週の範囲"
        );
        const yearRangeParts = yearRange
          .replace(/[¥$,円]/g, "")
          .trim()
          .split(/\s*-\s*/);

        // 時価総額のパース
        const marketCapStr = getStatValue("時価総額", "Market cap");

        // PERのパース（複数のラベル名に対応）
        const peStr = getStatValue(
          "株価収益率",
          "P/E ratio",
          "PER",
          "株価純資産倍率",
          "PBR"
        );
        const pe = parseFloat(peStr.replace(/[^0-9.-]/g, "")) || 0;

        // 配当利回りのパース
        const dividendStr = getStatValue(
          "配当利回り",
          "Dividend yield",
          "配当"
        );
        const dividend = parseFloat(dividendStr.replace(/[%％]/g, "")) || 0;

        const stockData = {
          symbol: data.summary.stock || symbol,
          price: data.summary.extracted_price || 0,
          change: data.summary.price_movement?.value || 0,
          changePercent: (data.summary.price_movement?.percentage || 0) * 100,
          volume: volume,
          marketCap: marketCapStr || "N/A",
          pe: pe,
          eps: 0, // Google FinanceではEPSは直接取得できない
          dividend: dividend,
          high52: parseFloat(yearRangeParts[1]) || 0,
          low52: parseFloat(yearRangeParts[0]) || 0,
        };

        return stockData;
      }

      return null;
    } catch (error: any) {
      console.error("SERPAPI株価データ取得エラー:", error.message);
      return null;
    }
  }

  async getCompanyNews(symbol: string, limit: number = 10): Promise<any[]> {
    try {
      const formattedQuery = this.formatSymbolQuery(symbol);
      const data = await this.getGoogleFinanceData(formattedQuery);

      // Google Finance APIからニュースを取得
      const newsResults = data.news_results || [];
      const news = newsResults.flatMap((result: any) => result.items || []);

      // ニュースデータを整形
      const formattedNews = news.map((item: any) => ({
        title: item.title || item.snippet,
        snippet: item.snippet || item.title,
        source: item.source || "Google Finance",
        date: item.date
          ? new Date(item.date).toLocaleDateString("ja-JP")
          : "不明",
        link: item.link,
      }));

      return formattedNews.slice(0, limit);
    } catch (error: any) {
      console.error("SERPAPIニュース取得エラー:", error.message);
      return [];
    }
  }

  /**
   * Google検索から企業関連ニュースを取得
   */
  async getCompanyNewsFromGoogle(
    symbol: string,
    companyName: string,
    limit: number = 10
  ): Promise<any[]> {
    try {
      // より具体的な検索クエリを作成
      const searchQuery = `"${companyName}" OR "${symbol}" ニュース 株価 決算 業績 2024 2025`;

      const response = await axios.get(SERPAPI_BASE_URL, {
        params: {
          engine: "google",
          q: searchQuery,
          api_key: this.apiKey,
          hl: "ja",
          num: limit * 2, // フィルタリング前により多くの結果を取得
          tbs: "qdr:w", // 過去1週間のニュースに限定
        },
      });

      const organicResults = response.data.organic_results || [];

      // 関連性フィルタリング：企業名またはシンボルが含まれているニュースのみ
      const relevantResults = organicResults.filter((result: any) => {
        const title = (result.title || "").toLowerCase();
        const snippet = (result.snippet || "").toLowerCase();
        const companyNameLower = companyName.toLowerCase();
        const symbolLower = symbol.toLowerCase();

        return (
          title.includes(companyNameLower) ||
          snippet.includes(companyNameLower) ||
          title.includes(symbolLower) ||
          snippet.includes(symbolLower)
        );
      });

      return relevantResults.map((result: any) => ({
        title: result.title,
        snippet: result.snippet,
        source: result.source || "Google検索",
        date: result.date || "不明",
        link: result.link,
      }));
    } catch (error: any) {
      console.error("Google検索ニュース取得エラー:", error.message);
      return [];
    }
  }

  async getChartData(
    symbol: string,
    window: string = "1M"
  ): Promise<ChartDataPoint[]> {
    try {
      const formattedQuery = this.formatSymbolQuery(symbol);
      const data = await this.getGoogleFinanceData(formattedQuery, { window });
      const graphData = data.graph || [];

      // グラフデータをChartDataPoint形式に変換
      const chartData: ChartDataPoint[] = graphData.map((point: any) => {
        const dataPoint: ChartDataPoint = {
          date: point.date || "",
          price: point.price || 0,
          volume: point.volume || 0,
        };

        // 重要イベントがある場合は追加
        if (point.key_event) {
          dataPoint.keyEvent = {
            title: point.key_event.title,
            link: point.key_event.link,
            source: point.key_event.source,
          };
        }

        return dataPoint;
      });

      return chartData;
    } catch (error: any) {
      console.error("SERPAPIチャートデータ取得エラー:", error.message);
      return [];
    }
  }

  async getFinancialData(symbol: string): Promise<FinancialData | null> {
    try {
      const formattedQuery = this.formatSymbolQuery(symbol);
      const data = await this.getGoogleFinanceData(formattedQuery);
      const financials = data.financials || [];

      // 最新の四半期または年次データを取得
      const incomeStatement = financials.find(
        (f: any) => f.title === "Income Statement" || f.title === "損益計算書"
      );
      const balanceSheet = financials.find(
        (f: any) => f.title === "Balance Sheet" || f.title === "貸借対照表"
      );

      if (!incomeStatement) {
        return null;
      }

      // 最新の期間データを取得（四半期優先）
      const latestPeriod = incomeStatement.results?.[0];
      const latestBalance = balanceSheet?.results?.[0];

      const getValue = (table: any[], ...titles: string[]) => {
        if (!table) return undefined;
        for (const title of titles) {
          const item = table.find((row: any) => row.title === title);
          if (item?.value) return item.value;
        }
        return undefined;
      };

      const financialData: FinancialData = {
        revenue: getValue(
          latestPeriod?.table || [],
          "Revenue",
          "売上高",
          "Total revenue"
        ),
        netIncome: getValue(
          latestPeriod?.table || [],
          "Net income",
          "純利益",
          "当期純利益"
        ),
        operatingIncome: getValue(
          latestPeriod?.table || [],
          "Operating income",
          "営業利益"
        ),
        totalAssets: getValue(
          latestBalance?.table || [],
          "Total assets",
          "総資産"
        ),
        totalLiabilities: getValue(
          latestBalance?.table || [],
          "Total liabilities",
          "総負債"
        ),
        cash: getValue(
          latestBalance?.table || [],
          "Cash and short-term investments",
          "現金及び現金同等物",
          "現金・預金"
        ),
        eps: getValue(
          latestPeriod?.table || [],
          "EPS",
          "Basic EPS",
          "Diluted EPS",
          "1株当たり利益"
        ),
        period: `${latestPeriod?.date || ""} (${
          latestPeriod?.period_type || ""
        })`,
      };

      return financialData;
    } catch (error: any) {
      console.error("SERPAPI財務データ取得エラー:", error.message);
      return null;
    }
  }
}
