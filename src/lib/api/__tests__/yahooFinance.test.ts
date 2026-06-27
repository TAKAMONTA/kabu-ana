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

  it("maps Yahoo chart quotes into ChartDataPoint[] and passes interval/period", async () => {
    vi.mocked(yahooFinance.chart).mockResolvedValue({
      quotes: [
        { date: new Date("2026-05-28T00:00:00Z"), close: 3000, volume: 1000 },
        { date: new Date("2026-05-29T00:00:00Z"), close: 3010, volume: 1200 },
      ],
    } as never);

    const client = new YahooFinanceClient();
    const chart = await client.getChartData("7203", "1M");

    const call = vi.mocked(yahooFinance.chart).mock.calls[0];
    expect(call[0]).toBe("7203.T");
    expect((call[1] as { interval: string }).interval).toBe("1d");
    expect(chart).toEqual([
      { date: "2026-05-28", price: 3000, volume: 1000 },
      { date: "2026-05-29", price: 3010, volume: 1200 },
    ]);
  });

  it("returns [] on chart error", async () => {
    vi.mocked(yahooFinance.chart).mockRejectedValue(new Error("boom"));
    const client = new YahooFinanceClient();
    expect(await client.getChartData("7203", "1M")).toEqual([]);
  });

  it("maps quoteSummary into FinancialData", async () => {
    vi.mocked(yahooFinance.quoteSummary).mockResolvedValue({
      incomeStatementHistory: {
        incomeStatementHistory: [
          {
            endDate: new Date("2026-03-31T00:00:00Z"),
            totalRevenue: 45_000_000_000_000,
            netIncome: 4_000_000_000_000,
            operatingIncome: 5_000_000_000_000,
          },
        ],
      },
      balanceSheetHistory: {
        balanceSheetStatements: [
          {
            totalAssets: 90_000_000_000_000,
            totalLiab: 50_000_000_000_000,
            cash: 10_000_000_000_000,
          },
        ],
      },
      defaultKeyStatistics: { trailingEps: 285 },
    } as never);

    const client = new YahooFinanceClient();
    const fin = await client.getFinancialData("7203");

    expect(vi.mocked(yahooFinance.quoteSummary)).toHaveBeenCalledWith(
      "7203.T",
      expect.objectContaining({
        modules: expect.arrayContaining([
          "incomeStatementHistory",
          "balanceSheetHistory",
          "defaultKeyStatistics",
        ]),
      })
    );
    expect(fin).toMatchObject({
      revenue: "45000000000000",
      netIncome: "4000000000000",
      operatingIncome: "5000000000000",
      totalAssets: "90000000000000",
      totalLiabilities: "50000000000000",
      cash: "10000000000000",
      eps: "285",
    });
    expect(fin?.period).toContain("2026");
  });

  it("returns null when income statement is missing", async () => {
    vi.mocked(yahooFinance.quoteSummary).mockResolvedValue({} as never);
    const client = new YahooFinanceClient();
    expect(await client.getFinancialData("7203")).toBeNull();
  });

  it("builds CompanyInfo from a quote, enriching JP names from JPX master", async () => {
    vi.mocked(yahooFinance.quote).mockResolvedValue({
      symbol: "7203.T",
      longName: "Toyota Motor Corporation",
      shortName: "TOYOTA",
      fullExchangeName: "Tokyo",
      regularMarketPrice: 3000,
      regularMarketChange: 10,
      regularMarketChangePercent: 0.33,
    } as never);

    const client = new YahooFinanceClient();
    const info = await client.searchCompany("7203");

    expect(info).toMatchObject({
      symbol: "7203.T",
      market: "Tokyo",
      price: 3000,
    });
    // JPX master の日本語社名で上書きされる（7203 = トヨタ自動車）
    expect(info?.name).toContain("トヨタ");
  });

  it("resolves a company via Yahoo search (searchCompanyByGoogle)", async () => {
    vi.mocked(yahooFinance.search).mockResolvedValue({
      quotes: [
        {
          isYahooFinance: true,
          symbol: "AAPL",
          shortname: "Apple Inc.",
          exchange: "NMS",
        },
      ],
      news: [],
    } as never);

    const client = new YahooFinanceClient();
    const info = await client.searchCompanyByGoogle("apple");

    expect(info).toEqual({ name: "Apple Inc.", symbol: "AAPL", market: "NMS" });
  });
});
