import { describe, it, expect, vi, beforeEach } from "vitest";
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
import { JQuantsClient, toJQuantsCode } from "../jquants";
import { JPX_STOCK_BY_CODE } from "@/lib/jpx/stockMaster";

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
    fetchMock.mockResolvedValueOnce(
      okJson([{ Code: "72030", CoName: "トヨタ自動車", S33Nm: "輸送用機器" }])
    );
    const c = new JQuantsClient("k");
    const r = await c.searchCompany("7203");
    expect(r).toMatchObject({ name: "トヨタ自動車", symbol: "7203" });
  });

  describe("searchCompany display name by assetType", () => {
    // J-Quants の CoName は ETF・ETN で「<運用会社名>　<ファンド名>」形式になる。
    // 非個別株はローカルマスタの短い正式名を使い、個別株は CoName のままにする。
    const nameOf = (code: string) => JPX_STOCK_BY_CODE.get(code)?.name;

    it("prefers the local master name for an ETF (1476)", async () => {
      fetchMock.mockResolvedValueOnce(
        okJson([
          {
            Code: "14760",
            CoName:
              "ブラックロック・ジャパン株式会社　ｉシェアーズ・コア　Ｊリート　ＥＴＦ",
            S33Nm: "その他",
          },
        ])
      );
      const r = await new JQuantsClient("k").searchCompany("1476");
      expect(JPX_STOCK_BY_CODE.get("1476")?.assetType).toBe("etf");
      expect(r?.name).toBe(nameOf("1476"));
      expect(r?.name).not.toContain("ブラックロック・ジャパン株式会社");
    });

    it("prefers the local master name for an ETF (1306)", async () => {
      fetchMock.mockResolvedValueOnce(
        okJson([
          {
            Code: "13060",
            CoName:
              "野村アセットマネジメント株式会社　ＮＥＸＴ　ＦＵＮＤＳ　ＴＯＰＩＸ連動型上場投信",
            S33Nm: "その他",
          },
        ])
      );
      const r = await new JQuantsClient("k").searchCompany("1306");
      expect(r?.name).toBe(nameOf("1306"));
      expect(r?.name).not.toContain("野村アセットマネジメント株式会社");
    });

    it("prefers the local master name for a REIT (8956)", async () => {
      fetchMock.mockResolvedValueOnce(
        okJson([
          {
            Code: "89560",
            CoName: "運用会社名が付く可能性のある表記",
            S33Nm: "その他",
          },
        ])
      );
      const r = await new JQuantsClient("k").searchCompany("8956");
      expect(JPX_STOCK_BY_CODE.get("8956")?.assetType).toBe("reit");
      expect(r?.name).toBe(nameOf("8956"));
    });

    // 最重要の回帰ガード: 個別株の表示名は J-Quants 由来のまま変えない。
    it("keeps using CoName for an equity even when it differs from the master", async () => {
      fetchMock.mockResolvedValueOnce(
        okJson([
          {
            Code: "72030",
            CoName: "トヨタ自動車株式会社",
            S33Nm: "輸送用機器",
          },
        ])
      );
      const r = await new JQuantsClient("k").searchCompany("7203");
      expect(JPX_STOCK_BY_CODE.get("7203")?.assetType).toBe("equity");
      expect(r?.name).toBe("トヨタ自動車株式会社");
      expect(r?.name).not.toBe(nameOf("7203"));
    });

    it("falls back to CoName for a code missing from the local master", async () => {
      expect(JPX_STOCK_BY_CODE.get("9999")).toBeUndefined();
      fetchMock.mockResolvedValueOnce(
        okJson([{ Code: "99990", CoName: "未収録テスト銘柄", S33Nm: "その他" }])
      );
      const r = await new JQuantsClient("k").searchCompany("9999");
      expect(r?.name).toBe("未収録テスト銘柄");
      expect(r?.market).toBe("東証");
    });

    it("does not change market or description for non-equities", async () => {
      fetchMock.mockResolvedValueOnce(
        okJson([{ Code: "13060", CoName: "運用会社　X", S33Nm: "その他" }])
      );
      const r = await new JQuantsClient("k").searchCompany("1306");
      expect(r?.market).toBe(JPX_STOCK_BY_CODE.get("1306")?.marketSegment);
      expect(r?.description).toBe("その他");
      expect(r?.symbol).toBe("1306");
    });
  });

  it("getChartData maps bars/daily (AdjC→price)", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([
        { Date: "2026-06-25", C: 2700, AdjC: 2700, Vo: 100 },
        { Date: "2026-06-26", C: 2768, AdjC: 2768, Vo: 200 },
      ])
    );
    const c = new JQuantsClient("k");
    const pts = await c.getChartData("7203", "1M");
    expect(pts[pts.length - 1]).toEqual({
      date: "2026-06-26",
      price: 2768,
      volume: 200,
    });
  });

  it("getStockData computes change from last two closes", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([
        { Date: "2026-06-25", C: 2700, Vo: 100 },
        { Date: "2026-06-26", C: 2768, Vo: 200 },
      ])
    );
    const c = new JQuantsClient("k");
    const s = await c.getStockData("7203");
    expect(s).toMatchObject({
      symbol: "7203",
      price: 2768,
      change: 68,
      volume: 200,
    });
  });

  it("getFinancialData maps /fins/summary", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([
        {
          Sales: "45000000",
          OP: "5000000",
          NP: "4000000",
          EPS: "300",
          CurPerEn: "2026-03-31",
        },
      ])
    );
    const c = new JQuantsClient("k");
    const f = await c.getFinancialData("7203");
    expect(f).toMatchObject({
      revenue: "45000000",
      operatingIncome: "5000000",
      netIncome: "4000000",
      eps: "300",
    });
  });
});
