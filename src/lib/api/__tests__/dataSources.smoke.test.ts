import { describe, it, expect } from "vitest";
import { JQuantsClient } from "../jquants";
import { TwelveDataClient } from "../twelveData";

const hasJ = !!process.env.JQUANTS_API_KEY;
const hasT = !!process.env.TWELVE_DATA_API_KEY;

describe.skipIf(!hasJ)("J-Quants 実API", () => {
  it("7203 の株価とチャートを実取得できる", async () => {
    const c = new JQuantsClient();
    const s = await c.getStockData("7203");
    expect(s && s.price).toBeGreaterThan(0);
    const chart = await c.getChartData("7203", "1M");
    expect(chart.length).toBeGreaterThan(0);
  }, 20000);
});

describe.skipIf(!hasT)("Twelve Data 実API", () => {
  it("AAPL の株価とチャートを実取得できる", async () => {
    const c = new TwelveDataClient();
    const s = await c.getStockData("AAPL");
    expect(s && s.price).toBeGreaterThan(0);
    const chart = await c.getChartData("AAPL", "1M");
    expect(chart.length).toBeGreaterThan(0);
  }, 20000);
});
