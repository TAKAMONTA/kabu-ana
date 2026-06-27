import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SerpApiClient } from "../serpapi";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock("@/lib/utils/textUtils", () => ({
  normalizeQuery: (value: string) => String(value).replace(/\s+/g, ""),
  toHalfWidth: (value: string) => String(value),
}));

const googleFinanceResponse = {
  data: {
    summary: {
      title: "トヨタ自動車",
      stock: "7203",
      exchange: "TYO",
      extracted_price: 3000,
      price_movement: { value: 10, percentage: 0.01 },
    },
    knowledge_graph: {
      about: [{ description: { snippet: "自動車メーカー" } }],
      key_stats: {
        stats: [
          { label: "時価総額", value: "45兆" },
          { label: "PER", value: "10.5" },
          { label: "配当利回り", value: "2.1%" },
          { label: "52週範囲", value: "2500 - 3500" },
        ],
      },
    },
    news_results: [
      {
        items: [
          {
            title: "トヨタ、国内販売が好調",
            snippet: "販売増",
            source: "News",
            date: "2026-05-28",
            link: "https://example.com",
          },
        ],
      },
    ],
    financials: [
      {
        title: "Income Statement",
        results: [
          {
            date: "2026",
            period_type: "FY",
            table: [
              { title: "Revenue", value: "45T" },
              { title: "Net income", value: "4T" },
              { title: "Operating income", value: "5T" },
              { title: "EPS", value: "300" },
            ],
          },
        ],
      },
      {
        title: "Balance Sheet",
        results: [
          {
            table: [
              { title: "Total assets", value: "90T" },
              { title: "Total liabilities", value: "50T" },
              { title: "Cash and short-term investments", value: "10T" },
            ],
          },
        ],
      },
    ],
  },
};

describe("SerpApiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses the same Google Finance response for company, quote, news, and financial data", async () => {
    const get = vi.mocked(axios.get);
    get.mockResolvedValue(googleFinanceResponse);

    const client = new SerpApiClient("serp-key");

    await client.searchCompany("7203");
    await client.getStockData("7203");
    await client.getCompanyNews("7203", 5);
    await client.getFinancialData("7203");

    expect(get).toHaveBeenCalledTimes(1);
  });

  it("normalizes changePercent as a percent value without multiplying upstream percentages twice", async () => {
    const get = vi.mocked(axios.get);
    get.mockResolvedValue(googleFinanceResponse);

    const client = new SerpApiClient("serp-key");
    const stockData = await client.getStockData("7203");

    expect(stockData?.changePercent).toBeCloseTo((10 / 2990) * 100, 5);
    expect(stockData?.changePercent).toBeLessThan(1);
  });

  it("returns a fast partial search result when detailed Google Finance data is slow", async () => {
    const get = vi.mocked(axios.get);
    get.mockImplementation((_url, config: any) => {
      if (config.params.window) {
        return Promise.resolve({
          data: {
            summary: googleFinanceResponse.data.summary,
            graph: [
              {
                date: "2026-05-28",
                price: 3000,
                volume: 1000,
              },
            ],
          },
        });
      }
      return Promise.reject(new Error("timeout"));
    });

    const client = new SerpApiClient("serp-key");
    const result = await client.getFastSearchResult("7203", "1M");

    expect(result?.companyInfo.name).toBe("トヨタ自動車");
    expect(result?.stockData.price).toBe(3000);
    expect(result?.chartData).toHaveLength(1);
    expect(result?.newsData).toHaveLength(0);
    expect(result?.financialData).toBeNull();
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[0][1]).toMatchObject({ timeout: 1800 });
    expect(get.mock.calls[1][1]).toMatchObject({
      timeout: 3000,
      params: { window: "1M" },
    });
  });

  it("tries NYSE when a US ticker is not found on NASDAQ", async () => {
    const get = vi.mocked(axios.get);
    get.mockImplementation((_url, config: any) => {
      const { q, window } = config.params;
      if (q === "ORCL:NASDAQ") {
        return Promise.resolve({ data: {} });
      }
      if (q === "ORCL:NYSE" && window) {
        return Promise.resolve({
          data: {
            summary: {
              title: "Oracle Corp",
              stock: "ORCL",
              exchange: "NYSE",
              extracted_price: 120,
              price_movement: { value: 1, percentage: 0.01 },
            },
            graph: [{ date: "2026-05-28", price: 120, volume: 2000 }],
          },
        });
      }
      if (q === "ORCL:NYSE") {
        return Promise.reject(new Error("timeout"));
      }
      return Promise.resolve({ data: {} });
    });

    const client = new SerpApiClient("serp-key");
    const result = await client.getFastSearchResult("ORCL", "1M");

    expect(result?.companyInfo.market).toBe("NYSE");
    expect(result?.stockData.symbol).toBe("ORCL");
    expect(result?.chartData).toHaveLength(1);
    expect(
      get.mock.calls.map(
        call => (call[1] as { params: { q: string } }).params.q
      )
    ).toEqual(["ORCL:NASDAQ", "ORCL:NASDAQ", "ORCL:NYSE", "ORCL:NYSE"]);
  });
});
