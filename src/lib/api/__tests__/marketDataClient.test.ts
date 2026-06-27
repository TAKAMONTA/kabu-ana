import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("yahoo-finance2", () => ({
  default: {
    quote: vi.fn(),
    chart: vi.fn(),
    quoteSummary: vi.fn(),
    search: vi.fn(),
    suppressNotices: vi.fn(),
  },
}));

import { createMarketDataClient } from "../marketDataClient";
import { YahooFinanceClient } from "../yahooFinance";
import { SerpApiClient } from "../serpapi";

describe("createMarketDataClient", () => {
  const ORIGINAL = { ...process.env };
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it("defaults to YahooFinanceClient when no provider is set", () => {
    delete process.env.MARKET_DATA_PROVIDER;
    delete process.env.SERPAPI_API_KEY;
    expect(createMarketDataClient()).toBeInstanceOf(YahooFinanceClient);
  });

  it("returns SerpApiClient only when explicitly selected with a real key", () => {
    process.env.MARKET_DATA_PROVIDER = "serpapi";
    process.env.SERPAPI_API_KEY = "real-key";
    expect(createMarketDataClient()).toBeInstanceOf(SerpApiClient);
  });

  it("falls back to Yahoo when serpapi is selected but key is a placeholder", () => {
    process.env.MARKET_DATA_PROVIDER = "serpapi";
    process.env.SERPAPI_API_KEY = "your_serpapi_key_here";
    expect(createMarketDataClient()).toBeInstanceOf(YahooFinanceClient);
  });
});
