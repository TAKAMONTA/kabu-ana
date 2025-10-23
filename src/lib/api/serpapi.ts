import axios from "axios";
import { normalizeQuery } from "@/lib/utils/textUtils";

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

export class SerpApiClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchCompany(query: string): Promise<CompanyInfo | null> {
    try {
      // 全角→半角変換 & クエリの形式を整える
      let formattedQuery = normalizeQuery(query).toUpperCase();

      // すでに取引所が含まれていない場合は、デフォルトでNASDAQを追加
      if (!formattedQuery.includes(":")) {
        // 日本株かどうかを判定（4桁の数字のみ）
        if (/^\d{4}$/.test(formattedQuery)) {
          formattedQuery = `${formattedQuery}:TYO`; // Tokyo Stock Exchange
        } else {
          formattedQuery = `${formattedQuery}:NASDAQ`; // デフォルトはNASDAQ
        }
      }

      const response = await axios.get(SERPAPI_BASE_URL, {
        params: {
          engine: "google_finance",
          q: formattedQuery,
          api_key: this.apiKey,
          hl: "ja", // 日本語で結果を取得
        },
      });

      const data = response.data;

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

  async getStockData(symbol: string): Promise<StockData | null> {
    try {
      // 全角→半角変換 & クエリの形式を整える
      let formattedQuery = normalizeQuery(symbol).toUpperCase();

      if (!formattedQuery.includes(":")) {
        if (/^\d{4}$/.test(formattedQuery)) {
          formattedQuery = `${formattedQuery}:TYO`;
        } else {
          formattedQuery = `${formattedQuery}:NASDAQ`;
        }
      }

      const response = await axios.get(SERPAPI_BASE_URL, {
        params: {
          engine: "google_finance",
          q: formattedQuery,
          api_key: this.apiKey,
          hl: "ja", // 日本語で結果を取得
        },
      });

      const data = response.data;

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
      // 全角→半角変換 & クエリの形式を整える
      let formattedQuery = normalizeQuery(symbol).toUpperCase();

      if (!formattedQuery.includes(":")) {
        if (/^\d{4}$/.test(formattedQuery)) {
          formattedQuery = `${formattedQuery}:TYO`;
        } else {
          formattedQuery = `${formattedQuery}:NASDAQ`;
        }
      }

      const response = await axios.get(SERPAPI_BASE_URL, {
        params: {
          engine: "google_finance",
          q: formattedQuery,
          api_key: this.apiKey,
          hl: "ja", // 日本語で結果を取得
        },
      });

      // Google Finance APIからニュースを取得
      const newsResults = response.data.news_results || [];
      const news = newsResults.flatMap((result: any) => result.items || []);
      return news.slice(0, limit);
    } catch (error: any) {
      console.error("SERPAPIニュース取得エラー:", error.message);
      return [];
    }
  }

  async getChartData(
    symbol: string,
    window: string = "1M"
  ): Promise<ChartDataPoint[]> {
    try {
      // 全角→半角変換 & クエリの形式を整える
      let formattedQuery = normalizeQuery(symbol).toUpperCase();

      if (!formattedQuery.includes(":")) {
        if (/^\d{4}$/.test(formattedQuery)) {
          formattedQuery = `${formattedQuery}:TYO`;
        } else {
          formattedQuery = `${formattedQuery}:NASDAQ`;
        }
      }

      const response = await axios.get(SERPAPI_BASE_URL, {
        params: {
          engine: "google_finance",
          q: formattedQuery,
          api_key: this.apiKey,
          hl: "ja",
          window: window, // 期間指定（1D, 5D, 1M, 6M, 1Y, 5Y, MAX）
        },
      });

      const data = response.data;
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
      // 全角→半角変換 & クエリの形式を整える
      let formattedQuery = normalizeQuery(symbol).toUpperCase();

      if (!formattedQuery.includes(":")) {
        if (/^\d{4}$/.test(formattedQuery)) {
          formattedQuery = `${formattedQuery}:TYO`;
        } else {
          formattedQuery = `${formattedQuery}:NASDAQ`;
        }
      }

      const response = await axios.get(SERPAPI_BASE_URL, {
        params: {
          engine: "google_finance",
          q: formattedQuery,
          api_key: this.apiKey,
          hl: "ja",
        },
      });

      const data = response.data;
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
