// 株価データ取得用のライブラリ
// Yahoo Finance APIの代替として、複数のソースからデータを取得

interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  dayHigh: number;
  dayLow: number;
  yearHigh: number;
  yearLow: number;
  pe: number;
  eps: number;
  dividend: number;
  dividendYield: number;
  lastUpdated: string;
}

interface FinancialMetrics {
  revenue: number;
  revenueGrowth: number;
  grossProfit: number;
  operatingIncome: number;
  netIncome: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  cashFlow: number;
  roe: number;
  roa: number;
  currentRatio: number;
  debtToEquity: number;
  lastUpdated: string;
}

// Alpha Vantage API (無料枠あり)
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || "demo";
const ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query";

// Financial Modeling Prep API (無料枠あり)
const FMP_API_KEY = process.env.FMP_API_KEY || "";
const FMP_BASE_URL = "https://financialmodelingprep.com/api/v3";

// Polygon.io API (無料枠あり)
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || "";
const POLYGON_BASE_URL = "https://api.polygon.io";

// 株価データを取得
export async function getStockQuote(
  symbol: string
): Promise<StockQuote | null> {
  try {
    // まずAlpha Vantageから取得を試みる
    const quote = await getAlphaVantageQuote(symbol);
    if (quote) return quote;

    // 次にFinancial Modeling Prepから取得
    // const fmpQuote = await getFMPQuote(symbol);
    // if (fmpQuote) return fmpQuote;

    // 最後にPolygonから取得
    // const polygonQuote = await getPolygonQuote(symbol);
    // if (polygonQuote) return polygonQuote;

    // すべて失敗した場合はnullを返す
    console.error(`Failed to fetch quote for ${symbol} from all sources`);
    return null;
  } catch (error) {
    console.error("Error fetching stock quote:", error);
    return null;
  }
}

// Alpha Vantageから株価を取得
async function getAlphaVantageQuote(
  symbol: string
): Promise<StockQuote | null> {
  try {
    const quoteUrl = `${ALPHA_VANTAGE_BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    const overviewUrl = `${ALPHA_VANTAGE_BASE_URL}?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;

    const [quoteResponse, overviewResponse] = await Promise.all([
      fetch(quoteUrl),
      fetch(overviewUrl),
    ]);

    if (!quoteResponse.ok || !overviewResponse.ok) {
      return null;
    }

    const quoteData = await quoteResponse.json();
    const overviewData = await overviewResponse.json();

    if (
      !quoteData["Global Quote"] ||
      Object.keys(quoteData["Global Quote"]).length === 0
    ) {
      return null;
    }

    const quote = quoteData["Global Quote"];
    const overview = overviewData;

    return {
      symbol: symbol,
      name: overview.Name || symbol,
      price: parseFloat(quote["05. price"]) || 0,
      change: parseFloat(quote["09. change"]) || 0,
      changePercent:
        parseFloat(quote["10. change percent"]?.replace("%", "")) || 0,
      volume: parseInt(quote["06. volume"]) || 0,
      marketCap: parseFloat(overview.MarketCapitalization) || 0,
      dayHigh: parseFloat(quote["03. high"]) || 0,
      dayLow: parseFloat(quote["04. low"]) || 0,
      yearHigh: parseFloat(overview["52WeekHigh"]) || 0,
      yearLow: parseFloat(overview["52WeekLow"]) || 0,
      pe: parseFloat(overview.PERatio) || 0,
      eps: parseFloat(overview.EPS) || 0,
      dividend: parseFloat(overview.DividendPerShare) || 0,
      dividendYield: parseFloat(overview.DividendYield) || 0,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error fetching Alpha Vantage quote:", error);
    return null;
  }
}
