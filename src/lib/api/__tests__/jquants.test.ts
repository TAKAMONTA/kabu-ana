import { describe, it, expect, vi, beforeEach } from "vitest";
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
import { JQuantsClient, toJQuantsCode } from "../jquants";

const okJson = (data: any) => ({ json: async () => ({ data }) });

beforeEach(() => fetchMock.mockReset());

describe("toJQuantsCode", () => {
  it("pads 4-digit to 5-digit", () => {
    expect(toJQuantsCode("7203")).toBe("72030");
    expect(toJQuantsCode("72030")).toBe("72030");
  });
});

describe("JQuantsClient", () => {
  it("searchCompany maps /equities/master", async () => {
    fetchMock.mockResolvedValueOnce(okJson([{ Code: "72030", CoName: "トヨタ自動車", S33Nm: "輸送用機器" }]));
    const c = new JQuantsClient("k");
    const r = await c.searchCompany("7203");
    expect(r).toMatchObject({ name: "トヨタ自動車", symbol: "7203" });
  });

  it("getChartData maps bars/daily (AdjC→price)", async () => {
    fetchMock.mockResolvedValueOnce(okJson([
      { Date: "2026-06-25", C: 2700, AdjC: 2700, Vo: 100 },
      { Date: "2026-06-26", C: 2768, AdjC: 2768, Vo: 200 },
    ]));
    const c = new JQuantsClient("k");
    const pts = await c.getChartData("7203", "1M");
    expect(pts[pts.length - 1]).toEqual({ date: "2026-06-26", price: 2768, volume: 200 });
  });

  it("getStockData computes change from last two closes", async () => {
    fetchMock.mockResolvedValueOnce(okJson([
      { Date: "2026-06-25", C: 2700, Vo: 100 },
      { Date: "2026-06-26", C: 2768, Vo: 200 },
    ]));
    const c = new JQuantsClient("k");
    const s = await c.getStockData("7203");
    expect(s).toMatchObject({ symbol: "7203", price: 2768, change: 68, volume: 200 });
  });

  it("getFinancialData maps /fins/summary", async () => {
    fetchMock.mockResolvedValueOnce(okJson([{ Sales: "45000000", OP: "5000000", NP: "4000000", EPS: "300", CurPerEn: "2026-03-31" }]));
    const c = new JQuantsClient("k");
    const f = await c.getFinancialData("7203");
    expect(f).toMatchObject({ revenue: "45000000", operatingIncome: "5000000", netIncome: "4000000", eps: "300" });
  });
});
