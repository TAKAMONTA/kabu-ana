import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("yahoo-finance2", () => ({
  default: {
    quote: vi.fn(),
    chart: vi.fn(),
    quoteSummary: vi.fn(),
    search: vi.fn(),
    suppressNotices: vi.fn(),
  },
}));

import yahooFinance from "yahoo-finance2";
import { YahooFinanceClient, toYahooSymbol } from "../yahooFinance";

describe("toYahooSymbol", () => {
  it("maps a 4-digit Japanese code to the .T suffix", () => {
    expect(toYahooSymbol("7203")).toBe("7203.T");
  });

  it("maps an exchange-suffixed JP query to .T", () => {
    expect(toYahooSymbol("7203:TYO")).toBe("7203.T");
  });

  it("keeps a US ticker as-is and strips the exchange suffix", () => {
    expect(toYahooSymbol("AAPL:NASDAQ")).toBe("AAPL");
    expect(toYahooSymbol("aapl")).toBe("AAPL");
  });
});

describe("YahooFinanceClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is constructible without an API key", () => {
    expect(() => new YahooFinanceClient()).not.toThrow();
  });

  it("maps a Yahoo quote into StockData", async () => {
    vi.mocked(yahooFinance.quote).mockResolvedValue({
      symbol: "7203.T",
      regularMarketPrice: 3000,
      regularMarketChange: 10,
      regularMarketChangePercent: 0.33,
      regularMarketVolume: 1_000_000,
      marketCap: 45_000_000_000_000,
      trailingPE: 10.5,
      epsTrailingTwelveMonths: 285,
      trailingAnnualDividendYield: 0.021,
      fiftyTwoWeekHigh: 3500,
      fiftyTwoWeekLow: 2500,
    } as never);

    const client = new YahooFinanceClient();
    const data = await client.getStockData("7203");

    expect(vi.mocked(yahooFinance.quote)).toHaveBeenCalledWith("7203.T");
    expect(data).toMatchObject({
      symbol: "7203.T",
      price: 3000,
      change: 10,
      changePercent: 0.33,
      volume: 1_000_000,
      pe: 10.5,
      eps: 285,
      high52: 3500,
      low52: 2500,
    });
    expect(data?.dividend).toBeCloseTo(2.1, 5);
    expect(data?.marketCap).toBe("45000000000000");
  });

  it("returns null when quote is empty", async () => {
    vi.mocked(yahooFinance.quote).mockResolvedValue(undefined as never);
    const client = new YahooFinanceClient();
    expect(await client.getStockData("ZZZZ")).toBeNull();
  });
});
