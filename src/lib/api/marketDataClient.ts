import { SerpApiClient } from "./serpapi";
import { YahooFinanceClient } from "./yahooFinance";
import type { MarketDataClient } from "./marketDataTypes";

const PLACEHOLDER_SERP_KEY = "your_serpapi_key_here";

/**
 * 市場データクライアントを生成する。
 * 既定は無料の Yahoo Finance。MARKET_DATA_PROVIDER=serpapi かつ実キーがある時のみ SerpAPI。
 */
export function createMarketDataClient(): MarketDataClient {
  const provider = (process.env.MARKET_DATA_PROVIDER ?? "yahoo").toLowerCase();
  const serpKey = process.env.SERPAPI_API_KEY;
  const hasRealSerpKey = Boolean(serpKey) && serpKey !== PLACEHOLDER_SERP_KEY;

  if (provider === "serpapi" && hasRealSerpKey) {
    return new SerpApiClient(serpKey as string);
  }
  return new YahooFinanceClient();
}
