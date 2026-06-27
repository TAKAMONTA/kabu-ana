import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createMarketDataClient } from "../marketDataClient";
import { MarketDataRouter } from "../marketDataRouter";
import { SerpApiClient } from "../serpapi";

describe("createMarketDataClient", () => {
  const ORIGINAL = { ...process.env };
  beforeEach(() => {});
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it("defaults to MarketDataRouter when no provider is set", () => {
    delete process.env.MARKET_DATA_PROVIDER;
    delete process.env.SERPAPI_API_KEY;
    expect(createMarketDataClient()).toBeInstanceOf(MarketDataRouter);
  });

  it("returns SerpApiClient only when explicitly selected with a real key", () => {
    process.env.MARKET_DATA_PROVIDER = "serpapi";
    process.env.SERPAPI_API_KEY = "real-key";
    expect(createMarketDataClient()).toBeInstanceOf(SerpApiClient);
  });

  it("falls back to MarketDataRouter when serpapi is selected but key is a placeholder", () => {
    process.env.MARKET_DATA_PROVIDER = "serpapi";
    process.env.SERPAPI_API_KEY = "your_serpapi_key_here";
    expect(createMarketDataClient()).toBeInstanceOf(MarketDataRouter);
  });
});
