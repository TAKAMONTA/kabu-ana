import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { TwelveDataClient } from "../twelveData";

const quote = {
  symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", currency: "USD",
  close: "281.20", change: "6.05", percent_change: "2.19", volume: "261244321",
  fifty_two_week: { low: "199.25", high: "317.39" },
};

beforeEach(() => fetchMock.mockReset());

describe("TwelveDataClient", () => {
  it("getStockData maps /quote fields", async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => quote });
    const c = new TwelveDataClient("k");
    const s = await c.getStockData("AAPL");
    expect(s).toMatchObject({ symbol: "AAPL", price: 281.2, changePercent: 2.19, volume: 261244321, high52: 317.39, low52: 199.25 });
  });

  it("searchCompany maps name/exchange", async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => quote });
    const c = new TwelveDataClient("k");
    const r = await c.searchCompany("AAPL");
    expect(r).toMatchObject({ name: "Apple Inc.", symbol: "AAPL", market: "NASDAQ" });
  });

  it("getChartData maps /time_series values", async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => ({ values: [
      { datetime: "2026-06-26", open: "1", high: "2", low: "0.5", close: "281.2", volume: "100" },
    ] }) });
    const c = new TwelveDataClient("k");
    const pts = await c.getChartData("AAPL", "1M");
    expect(pts[0]).toEqual({ date: "2026-06-26", price: 281.2, volume: 100 });
  });

  it("returns null on error payload", async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => ({ status: "error", message: "bad" }) });
    const c = new TwelveDataClient("k");
    expect(await c.getStockData("AAPL")).toBeNull();
  });
});
