import { afterEach, describe, expect, it, vi } from "vitest";

import { createMarketDataClient } from "../marketDataClient";
import { MarketDataRouter } from "../marketDataRouter";
import { JQuantsClient } from "../jquants";
import { TwelveDataClient } from "../twelveData";
import type { MarketDataClient } from "../marketDataTypes";

describe("createMarketDataClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a MarketDataRouter instance that fully implements MarketDataClient", () => {
    const client: MarketDataClient = createMarketDataClient();
    expect(client).toBeInstanceOf(MarketDataRouter);

    // 型レベル: MarketDataClient のメソッド面をすべて備えていること
    const methodNames: Array<keyof MarketDataClient> = [
      "getFastSearchResult",
      "searchCompany",
      "searchCompanyByGoogle",
      "getStockData",
      "getCompanyNews",
      "getCompanyNewsFromGoogle",
      "getChartData",
      "getFinancialData",
    ];
    for (const name of methodNames) {
      expect(typeof client[name]).toBe("function");
    }
  });

  it("routes Japanese stock codes to J-Quants and US tickers to Twelve Data", async () => {
    // 挙動レベル: 生成されたクライアントが実際に銘柄種別ごとに正しい下位クライアントへ委譲すること
    const jpSpy = vi
      .spyOn(JQuantsClient.prototype, "getStockData")
      .mockResolvedValue(null);
    const usSpy = vi
      .spyOn(TwelveDataClient.prototype, "getStockData")
      .mockResolvedValue(null);

    const client = createMarketDataClient();
    await client.getStockData("7203");
    await client.getStockData("AAPL");

    expect(jpSpy).toHaveBeenCalledWith("7203");
    expect(usSpy).toHaveBeenCalledWith("AAPL");
  });
});
