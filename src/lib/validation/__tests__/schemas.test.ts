import { describe, expect, it } from "vitest";
import {
  analysisSchema,
  financialEvaluationSchema,
  searchSchema,
} from "../schemas";

const VALID_ANALYSIS = {
  companyInfo: { name: "トヨタ自動車", symbol: "7203", market: "TYO" },
  stockData: {
    symbol: "7203",
    price: 2768,
    change: 68,
    changePercent: 2.5,
    volume: 100,
    marketCap: "N/A",
  },
  newsData: [
    { title: "t", snippet: "s", link: "https://example.com", source: "x", date: "2026-11-15" },
  ],
  // /api/search が返す ratios / financialHistory と同じ形
  edinetExtras: {
    ratios: { roe: 0.12, deRatio: 1.1, fcf: 1e11 },
    financialHistory: [{ fiscalYear: 2025, revenue: 4.5e13, operatingIncome: 5e12 }],
    accountingStandard: "IFRS",
  },
};

describe("analysisSchema", () => {
  it("accepts the payload shape the app sends", () => {
    expect(analysisSchema.safeParse(VALID_ANALYSIS).success).toBe(true);
  });

  it("rejects non-numeric ratios (previously a TypeError 500 in buildEdinetSections)", () => {
    const result = analysisSchema.safeParse({
      ...VALID_ANALYSIS,
      edinetExtras: { ratios: { deRatio: "1.1" } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-object financial history rows", () => {
    const result = analysisSchema.safeParse({
      ...VALID_ANALYSIS,
      edinetExtras: { financialHistory: ["x"] },
    });
    expect(result.success).toBe(false);
  });

  it("bounds the LLM input size (news count and text length)", () => {
    const item = VALID_ANALYSIS.newsData[0];
    expect(
      analysisSchema.safeParse({
        ...VALID_ANALYSIS,
        newsData: Array.from({ length: 31 }, () => item),
      }).success
    ).toBe(false);
    expect(
      analysisSchema.safeParse({
        ...VALID_ANALYSIS,
        newsData: [{ ...item, snippet: "x".repeat(5001) }],
      }).success
    ).toBe(false);
    expect(
      analysisSchema.safeParse({
        ...VALID_ANALYSIS,
        companyInfo: { ...VALID_ANALYSIS.companyInfo, name: "x".repeat(201) },
      }).success
    ).toBe(false);
  });
});

describe("financialEvaluationSchema", () => {
  it("accepts the app's request (J-Quants financial data are strings)", () => {
    const result = financialEvaluationSchema.safeParse({
      symbol: " 7203 ",
      companyName: "トヨタ自動車",
      financialData: { revenue: "45000000", netIncome: "4000000", period: "2026 (FY)" },
      edinetExtras: VALID_ANALYSIS.edinetExtras,
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.symbol).toBe("7203");
  });

  it("rejects missing/blank identifiers and wrong shapes", () => {
    for (const body of [
      null,
      {},
      { symbol: " ", companyName: "x" },
      { symbol: "7203", companyName: "x", financialData: "oops" },
      { symbol: "7203", companyName: "x", edinetExtras: { ratios: { roe: "high" } } },
      { symbol: "x".repeat(21), companyName: "x" },
    ]) {
      expect(financialEvaluationSchema.safeParse(body).success).toBe(false);
    }
  });
});

describe("searchSchema chartPeriod", () => {
  it("accepts every period the chart selector offers", () => {
    for (const chartPeriod of ["1D", "5D", "1M", "6M", "1Y", "5Y", "MAX"]) {
      expect(searchSchema.safeParse({ query: "7203", chartPeriod }).success).toBe(true);
    }
  });
});
