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
});
