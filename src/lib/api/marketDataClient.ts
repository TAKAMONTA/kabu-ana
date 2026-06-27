import { SerpApiClient } from "./serpapi";
import { MarketDataRouter } from "./marketDataRouter";
import type { MarketDataClient } from "./marketDataTypes";

const PLACEHOLDER_SERP_KEY = "your_serpapi_key_here";

/**
 * 市場データクライアントを生成する。
 * 既定は J-Quants(日本株)+Twelve Data(米国株) の Router。
 * 緊急時のみ MARKET_DATA_PROVIDER=serpapi + 実キーで SerpAPI に切替可能。
 */
export function createMarketDataClient(): MarketDataClient {
  const provider = (process.env.MARKET_DATA_PROVIDER ?? "router").toLowerCase();
  const serpKey = process.env.SERPAPI_API_KEY;
  const hasRealSerpKey = Boolean(serpKey) && serpKey !== PLACEHOLDER_SERP_KEY;
  if (provider === "serpapi" && hasRealSerpKey) {
    return new SerpApiClient(serpKey as string);
  }
  return new MarketDataRouter();
}
