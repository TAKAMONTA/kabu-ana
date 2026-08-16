import { MarketDataRouter } from "./marketDataRouter";
import type { MarketDataClient } from "./marketDataTypes";

/**
 * 市場データクライアントを生成する。
 * 日本株=J-Quants / 米国株=Twelve Data の自動振り分けを行う Router を返す。
 */
export function createMarketDataClient(): MarketDataClient {
  return new MarketDataRouter();
}
