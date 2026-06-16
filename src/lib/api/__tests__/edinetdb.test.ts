import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EdinetDBClient, getEdinetSearchQueryFromSymbol } from "../edinetdb";

const fetchMock = vi.fn();

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("EdinetDBClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it("reads company search results from the EDINET DB data envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            edinet_code: "E02144",
            name: "トヨタ自動車株式会社",
            sec_code: "72030",
          },
        ],
        meta: { query: "7203", total: 1 },
      })
    );

    const client = new EdinetDBClient("edinet-key");
    const results = await client.searchCompanies("7203", 3);

    expect(results).toEqual([
      {
        edinet_code: "E02144",
        name: "トヨタ自動車株式会社",
        sec_code: "72030",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://edinetdb.jp/v1/search?q=7203&per_page=3",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-API-Key": "edinet-key" }),
      })
    );
  });

  it("reads company detail from a single data object", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          accounting_standard: "USGAAP",
          edinet_code: "E02144",
          name: "トヨタ自動車株式会社",
        },
      })
    );

    const client = new EdinetDBClient("edinet-key");
    const company = await client.getCompany("E02144");

    expect(company).toMatchObject({
      accounting_standard: "USGAAP",
      edinet_code: "E02144",
    });
  });

  it("reads financial history from the EDINET DB data envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          { fiscal_year: 2025, revenue: 48036704000000 },
          { fiscal_year: 2026, revenue: 50684952000000 },
        ],
      })
    );

    const client = new EdinetDBClient("edinet-key");
    const financials = await client.getFinancials("E02144");

    expect(financials).toHaveLength(2);
    expect(financials[1]).toMatchObject({
      fiscal_year: 2026,
      revenue: 50684952000000,
    });
  });

  it("returns the latest fiscal year when ratios are a data array", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          { fiscal_year: 2024, roe: 0.158 },
          { fiscal_year: 2026, roe: 0.101 },
          { fiscal_year: 2025, roe: 0.136 },
        ],
      })
    );

    const client = new EdinetDBClient("edinet-key");
    const ratios = await client.getRatios("E02144");

    expect(ratios).toEqual({ fiscal_year: 2026, roe: 0.101 });
  });

  it("logs unexpected response envelopes instead of silently discarding EDINET data", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [
          {
            edinet_code: "E02144",
            name: "トヨタ自動車株式会社",
          },
        ],
      })
    );

    const client = new EdinetDBClient("edinet-key");
    const results = await client.searchCompanies("7203", 3);

    expect(results).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("EDINET DB レスポンス形式エラー"),
      expect.objectContaining({ path: "/search" })
    );
  });
});

describe("getEdinetSearchQueryFromSymbol", () => {
  it("accepts local JPX symbols without .T when the market is Tokyo", () => {
    expect(getEdinetSearchQueryFromSymbol("7203", "TYO")).toBe("7203");
  });

  it("accepts FMP-style Tokyo symbols with .T", () => {
    expect(getEdinetSearchQueryFromSymbol("7203.T")).toBe("7203");
  });

  it("does not treat plain US tickers as EDINET securities", () => {
    expect(getEdinetSearchQueryFromSymbol("AAPL", "NASDAQ")).toBeNull();
  });
});
