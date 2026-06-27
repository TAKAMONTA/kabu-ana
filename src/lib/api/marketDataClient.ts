import { SerpApiClient } from "./serpapi";
import { MarketDataRouter } from "./marketDataRouter";
import type { MarketDataClient } from "./marketDataTypes";

const PLACEHOLDER_SERP_KEY = "your_serpapi_key_here";

/**
 * 市場データクライアントを生成する。
 * 既定は J-Quants(日本株)+Twelve Data(米国株) の Router。
 * 旧 SerpAPI は緊急退避用として残すが、明示フラグなしでは選ばない。
 */
export function createMarketDataClient(): MarketDataClient {
  const provider = (process.env.MARKET_DATA_PROVIDER ?? "router").toLowerCase();
  const serpKey = process.env.SERPAPI_API_KEY;
  const hasRealSerpKey = Boolean(serpKey) && serpKey !== PLACEHOLDER_SERP_KEY;
  const allowLegacySerpApi = process.env.ENABLE_LEGACY_SERPAPI === "true";

  if (provider === "serpapi" && allowLegacySerpApi && hasRealSerpKey) {
    return new SerpApiClient(serpKey as string);
  }

  return new MarketDataRouter();
}
