import { describe, expect, it } from "vitest";
import {
  buildStableTopTradingItems,
  stripPublisherSuffix,
} from "../topTradingValue";
import { JPX_STOCK_BY_CODE } from "../jpx/stockMaster";

const RECENT_DATE = new Date().toISOString();
const STALE_DATE = "2026-03-04T00:00:00.000Z";

describe("buildStableTopTradingItems", () => {
  it("builds Japanese stock ideas from direct company mentions in market news", () => {
    const result = buildStableTopTradingItems([
      {
        title: "ソニーグループ、イメージセンサーとゲーム事業が好調",
        snippet: "PlayStationと半導体センサーの需要が市場で注目されています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/sony",
      },
      {
        title: "生成AI投資で半導体製造装置関連に買い",
        snippet:
          "東京エレクトロンやアドバンテストなどAI半導体関連が物色されています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/semiconductor",
      },
    ]);

    expect(result.source).toBe("news_signal_ranking");
    expect(result.items).toHaveLength(3);
    expect(result.items[0].rank).toBe(1);
    expect(result.items.map(item => item.code)).toContain("6758");
    expect(result.items.map(item => item.code)).toContain("8035");
    expect(result.items.map(item => item.code)).toContain("6857");
    expect(result.items.every(item => item.reason.length > 0)).toBe(true);
    expect(
      result.items.some(item =>
        item.sources.includes(
          "ソニーグループ、イメージセンサーとゲーム事業が好調"
        )
      )
    ).toBe(true);
  });

  it("deduplicates matched stocks without filling unrelated famous names", () => {
    const result = buildStableTopTradingItems([
      {
        title: "トヨタ自動車、円安と自動車販売が追い風",
        snippet: "トヨタの電動化戦略にも注目が集まっています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/toyota",
      },
    ]);

    expect(result.items).toHaveLength(1);
    expect(result.items.filter(item => item.code === "7203")).toHaveLength(1);
    expect(result.items[0].code).toBe("7203");
    expect(result.items[0].confidence).toBeGreaterThan(0.5);
  });

  it("returns no stocks when no news is available instead of inventing famous names", () => {
    const result = buildStableTopTradingItems([]);

    expect(result.source).toBe("news_unavailable");
    expect(result.items).toHaveLength(0);
    expect(result.matchedCount).toBe(0);
  });

  it("prioritizes direct company mentions in titles over generic theme matches", () => {
    const result = buildStableTopTradingItems([
      {
        title: "三菱重工、防衛関連の大型受注で注目",
        snippet: "防衛関連や宇宙事業への期待が広がっています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/mhi",
      },
      {
        title: "半導体関連に幅広く物色",
        snippet: "生成AI向けの投資拡大で半導体関連に関心が集まります。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/chips",
      },
    ]);

    expect(result.items[0].code).toBe("7011");
    expect(result.items[0].sources[0]).toBe(
      "三菱重工、防衛関連の大型受注で注目"
    );
  });

  it("keeps multiple themes represented when news mentions different sectors", () => {
    const result = buildStableTopTradingItems([
      {
        title: "INPEX、原油高とLNG需要で資源株に買い",
        snippet: "エネルギー市況の上昇が資源関連株の材料になっています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/inpex",
      },
      {
        title: "三菱UFJ、金利上昇観測で銀行株が堅調",
        snippet: "日銀の政策修正観測で金融株が注目されています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/banks",
      },
      {
        title: "任天堂、新ハード関連ニュースでゲーム株に関心",
        snippet: "人気IPと新ハードへの期待が続いています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/nintendo",
      },
    ]);

    expect(result.items.map(item => item.code)).toEqual(
      expect.arrayContaining(["1605", "8306", "7974"])
    );
  });

  it("does not match very short theme words inside unrelated English words", () => {
    const result = buildStableTopTradingItems([
      {
        title: "ソフトバンクグループ急反発 米オープンAIがIPO申請と報道",
        snippet: "AI投資への期待が続いています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/softbank-ipo",
      },
    ]);

    const nintendo = result.items.find(item => item.code === "7974");
    expect(result.items[0].code).toBe("9984");
    expect(result.matchedCount).toBe(1);
    expect(nintendo).toBeUndefined();
  });

  it("uses direct company matches for the reason before broader theme matches", () => {
    const result = buildStableTopTradingItems([
      {
        title: "半導体関連に幅広く物色",
        snippet: "AI投資を背景に半導体関連へ資金が向かっています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/semis",
      },
      {
        title: "ソフトバンクグループ、AI投資拡大で関心",
        snippet: "Armを含むAI関連投資が材料視されています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/softbank",
      },
    ]);

    const softbank = result.items.find(item => item.code === "9984");
    expect(softbank?.reason).toContain("ソフトバンクグループ");
  });

  it("adds a material label and evidence link from the matched news", () => {
    const result = buildStableTopTradingItems([
      {
        title: "三井E&S、港湾クレーン大型受注で急伸",
        snippet: "インフラ投資テーマの一角として出来高も増加しています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/mitsui-es-order",
      },
    ]);

    expect(result.items[0]).toMatchObject({
      code: "7003",
      signalLabel: "受注・提携",
      evidence: "三井E&S、港湾クレーン大型受注で急伸",
      sourceLinks: ["https://example.com/mitsui-es-order"],
    });
    expect(result.items[0].reason).toContain("受注・提携");
  });

  it("keeps publisher labels separate from evidence titles", () => {
    const result = buildStableTopTradingItems([
      {
        title: "三菱UFJ、日銀利上げ観測で銀行株に買い",
        snippet: "金利上昇の恩恵が金融株の材料として意識されています。",
        source: "日本経済新聞",
        date: RECENT_DATE,
        link: "https://example.com/mufg-rate",
      },
    ]);

    expect(result.items[0]).toMatchObject({
      code: "8306",
      evidence: "三菱UFJ、日銀利上げ観測で銀行株に買い",
      sources: ["日本経済新聞"],
    });
  });

  it("surfaces less obvious stocks when they are directly named in current news", () => {
    const result = buildStableTopTradingItems([
      {
        title: "メタプラネット、ビットコイン追加購入で急騰",
        snippet: "暗号資産関連の材料を受けて買いが集まっています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/metaplanet",
      },
      {
        title: "カバー、VTuber事業の成長期待で上昇",
        snippet: "ホロライブ関連の海外展開が材料視されています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/cover",
      },
      {
        title: "三井E&S、港湾クレーン関連の受注期待で続伸",
        snippet: "インフラ投資テーマの一角として物色されています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/mitsui-es",
      },
    ]);

    expect(result.items.map(item => item.code)).toEqual(
      expect.arrayContaining(["3350", "5253", "7003"])
    );
    expect(result.items).toHaveLength(3);
    expect(result.items.map(item => item.code)).not.toContain("7203");
    expect(result.items.map(item => item.code)).not.toContain("6758");
  });

  it("does not turn broad sector news into specific stocks when no company is named", () => {
    const result = buildStableTopTradingItems([
      {
        title: "生成AI投資の拡大で半導体関連株に関心",
        snippet: "市場では幅広い関連銘柄に物色が広がっています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/sector",
      },
    ]);

    expect(result.source).toBe("news_signal_ranking");
    expect(result.items).toHaveLength(0);
    expect(result.matchedCount).toBe(0);
  });

  it("does not treat a brokerage analyst byline as a stock material", () => {
    const result = buildStableTopTradingItems([
      {
        title: "日本株、史上最高値更新のけん引役は？ 野村證券・小髙貴久",
        snippet: "AI関連株に偏っているのかを市場ストラテジストが解説します。",
        source: "nomura.co.jp",
        date: RECENT_DATE,
        link: "https://example.com/nomura-commentary",
      },
    ]);

    expect(result.items.map(item => item.code)).not.toContain("8604");
    expect(result.items).toHaveLength(0);
  });

  it("excludes stale dated news from todays stock ideas", () => {
    const result = buildStableTopTradingItems([
      {
        title: "日本ケミコン、ストップ高で急伸",
        snippet: "古い材料記事です。",
        source: "Market News",
        date: STALE_DATE,
        link: "https://example.com/old-nippon-chemi-con",
      },
      {
        title: "菊池製作所、フィジカルAI関連で買い気配",
        snippet: "新しい材料記事です。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/recent-kikuchi",
      },
    ]);

    expect(result.items.map(item => item.code)).not.toContain("6997");
    expect(result.items.map(item => item.code)).toContain("3444");
  });

  it("deduplicates syndicated versions of the same article before scoring", () => {
    const result = buildStableTopTradingItems([
      {
        title:
          "【日本株】「高配当＆株価上昇」の両方で儲かる2銘柄！日本高純度化学、オービーシステムに注目 - ダイヤモンド・オンライン",
        snippet:
          "好業績と増配が材料です。日本高純度化学とオービーシステムを取り上げています。",
        source: "Diamond Online",
        date: RECENT_DATE,
        link: "https://example.com/diamond-original",
      },
      {
        title:
          "【日本株】｢高配当＆株価上昇｣の両方で儲かる2銘柄！日本高純度化学、オービーシステムに注目（ダイヤモンド・ザイ） - Yahoo!ニュース",
        snippet:
          "好業績と増配が材料です。日本高純度化学とオービーシステムを取り上げています。",
        source: "Yahoo!ニュース",
        date: RECENT_DATE,
        link: "https://example.com/yahoo-syndicated",
      },
    ]);

    const highPurity = result.items.find(item => item.code === "4973");
    expect(highPurity?.sources).toHaveLength(1);
    expect(highPurity?.sourceLinks).toHaveLength(1);
  });

  it("prefers distinct evidence sources before adding a second stock from the same article", () => {
    const result = buildStableTopTradingItems([
      {
        title: "日本高純度化学、オービーシステムに注目 好業績と増配が材料",
        snippet: "高配当と好業績を背景に2銘柄が取り上げられています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/dividend-two",
      },
      {
        title: "ローツェ、積水ハウスに注目 AI需要と米国事業の成長期待",
        snippet: "出遅れ感のある2銘柄として市場の関心を集めています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/reversal-two",
      },
      {
        title: "メタプラネット、ビットコイン追加購入で急騰",
        snippet: "暗号資産関連の材料を受けて買いが集まっています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/metaplanet",
      },
      {
        title: "カバー、海外イベント好調で上昇",
        snippet: "ホロライブ関連の海外展開が材料視されています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/cover",
      },
      {
        title: "三井E&S、港湾クレーン大型受注で急伸",
        snippet: "インフラ投資テーマの一角として出来高も増加しています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/mitsui-es",
      },
    ]);

    const codes = result.items.map(item => item.code);

    expect(result.items).toHaveLength(5);
    expect(codes).toEqual(expect.arrayContaining(["3350", "5253", "7003"]));
    expect(codes.filter(code => ["4973", "5576"].includes(code))).toHaveLength(
      1
    );
    expect(codes.filter(code => ["6323", "1928"].includes(code))).toHaveLength(
      1
    );
  });

  it("returns fewer than five items instead of padding with repeated article evidence", () => {
    const result = buildStableTopTradingItems([
      {
        title: "イーディーピーが急騰、かっこがストップ高",
        snippet: "新興市場銘柄の値動きが注目されています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/growth-digest",
      },
      {
        title: "日本ケミコン、ストップ高で目標株価引き上げ",
        snippet: "希薄化懸念の緩和が材料視されています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/nippon-chemi-con",
      },
      {
        title: "日本高純度化学、オービーシステムに注目 好業績と増配が材料",
        snippet: "高配当と好業績を背景に2銘柄が取り上げられています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/dividend-two",
      },
      {
        title: "ローツェ、積水ハウスに注目 AI需要と米国事業の成長期待",
        snippet: "出遅れ感のある2銘柄として市場の関心を集めています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/reversal-two",
      },
    ]);

    const codes = result.items.map(item => item.code);

    expect(result.items).toHaveLength(4);
    expect(codes).toContain("7794");
    expect(codes).toContain("6997");
    expect(codes.filter(code => ["4973", "5576"].includes(code))).toHaveLength(
      1
    );
    expect(codes.filter(code => ["6323", "1928"].includes(code))).toHaveLength(
      1
    );
  });

  it("derives varied attention scores from relative news signal strength", () => {
    const result = buildStableTopTradingItems([
      {
        title: "三井E&S、港湾クレーン大型受注でストップ高",
        snippet: "大型受注と出来高増加が材料です。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/mitsui-es-stop-high",
      },
      {
        title: "三井E&S、追加の大型受注観測で続伸",
        snippet: "港湾インフラ投資への期待が続きます。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/mitsui-es-order",
      },
      {
        title: "任天堂、新製品発表で関心",
        snippet: "ゲーム関連の新製品材料です。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/nintendo-product",
      },
    ]);

    const confidences = result.items.map(item => item.confidence);

    expect(result.items[0].code).toBe("7003");
    expect(new Set(confidences).size).toBeGreaterThan(1);
    expect(result.items[0].confidence).toBeGreaterThan(
      result.items[1].confidence
    );
    expect(Math.max(...confidences)).toBeLessThanOrEqual(0.94);
  });

  // 振る舞いテスト（レビュー指摘）: stockMaster.test.ts の
  // "excludes ETFs and funds from the stock idea universe" は STOCK_IDEA_UNIVERSE
  // という定数の性質しか検証しておらず、topTradingValue.ts 側で
  // `STOCK_IDEA_UNIVERSE.map(...)` を `JPX_STOCK_MASTER.map(...)` に書き換えても
  // 定数テストは緑のままETFが銘柄アイデアに漏れる。ここでは実際に
  // buildStableTopTradingItems へETF/REITの正式名称を含むニュースを渡し、
  // 返る items の全コードが equity であることを直接検証する。
  it("never surfaces ETFs/REITs as stock ideas even when their official name is in the news", () => {
    const result = buildStableTopTradingItems([
      {
        title: "NEXT FUNDS TOPIX連動型上場投信が続伸、資金流入が拡大",
        snippet: "TOPIX連動のETFに買いが続いています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/topix-etf",
      },
      {
        title: "東証REIT ETFが上昇、分配金利回りに注目",
        snippet: "東証REIT指数に連動するETFが物色されています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/reit-etf",
      },
      {
        title: "トヨタ自動車、円安と自動車販売が追い風",
        snippet: "トヨタの電動化戦略にも注目が集まっています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/toyota",
      },
    ]);

    expect(result.items.length).toBeGreaterThan(0);
    expect(
      result.items.every(
        item => JPX_STOCK_BY_CODE.get(item.code)?.assetType === "equity"
      )
    ).toBe(true);
    expect(result.items.map(item => item.code)).not.toContain("1306");
    expect(result.items.map(item => item.code)).not.toContain("2555");
    expect(result.items.map(item => item.code)).toContain("7203");
  });

  describe("freshness decay", () => {
    const NOW = new Date("2026-09-03T09:00:00.000Z").getTime();
    const daysAgo = (days: number) =>
      new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

    it("ranks todays news above equally-strong three-day-old news", () => {
      const result = buildStableTopTradingItems(
        [
          {
            title: "ソニーグループ、決算で上方修正",
            snippet: "業績上振れが材料視されています。",
            source: "Market News",
            date: daysAgo(3),
            link: "https://example.com/sony-old",
          },
          {
            title: "トヨタ自動車、決算で上方修正",
            snippet: "業績上振れが材料視されています。",
            source: "Market News",
            date: daysAgo(0),
            link: "https://example.com/toyota-today",
          },
        ],
        { now: NOW }
      );

      expect(result.items[0].code).toBe("7203");
      expect(result.items[1].code).toBe("6758");
      expect(result.items[0].confidence).toBeGreaterThan(
        result.items[1].confidence
      );
    });

    it("gives no additional freshness bonus once news is three days old or older", () => {
      const result = buildStableTopTradingItems(
        [
          {
            title: "ソニーグループ、決算で上方修正",
            snippet: "業績上振れが材料視されています。",
            source: "Market News",
            date: daysAgo(3),
            link: "https://example.com/sony-3d",
          },
          {
            title: "トヨタ自動車、決算で上方修正",
            snippet: "業績上振れが材料視されています。",
            source: "Market News",
            date: daysAgo(6),
            link: "https://example.com/toyota-6d",
          },
        ],
        { now: NOW }
      );

      expect(result.items[0].confidence).toBe(result.items[1].confidence);
    });

    it("applies decaying freshness bonuses of 9/6/3/0 for 0/1/2/3-day-old news of equal material strength", () => {
      const result = buildStableTopTradingItems(
        [
          {
            title: "ソニーグループ、決算で上方修正",
            snippet: "業績上振れが材料視されています。",
            source: "Market News",
            date: daysAgo(0),
            link: "https://example.com/sony-0d",
          },
          {
            title: "トヨタ自動車、決算で上方修正",
            snippet: "業績上振れが材料視されています。",
            source: "Market News",
            date: daysAgo(1),
            link: "https://example.com/toyota-1d",
          },
          {
            title: "任天堂、決算で上方修正",
            snippet: "業績上振れが材料視されています。",
            source: "Market News",
            date: daysAgo(2),
            link: "https://example.com/nintendo-2d",
          },
          {
            title: "三菱UFJ、決算で上方修正",
            snippet: "業績上振れが材料視されています。",
            source: "Market News",
            date: daysAgo(3),
            link: "https://example.com/mufg-3d",
          },
        ],
        { now: NOW }
      );

      // 同じ材料強度（タイトル一致+決算・業績）なので、順位とconfidenceの差は
      // 経過日数に応じた鮮度加点（+9/+6/+3/+0）だけに由来する。
      expect(result.items.map(item => item.code)).toEqual([
        "6758",
        "7203",
        "7974",
        "8306",
      ]);
      expect(result.items.map(item => item.confidence)).toEqual([
        0.94, 0.83, 0.73, 0.62,
      ]);
    });

    it("treats an article published at JST 07:00 as day 0 even though it falls on the previous UTC calendar day", () => {
      // NOW = 2026-09-03T10:00:00+09:00 (= 2026-09-03T01:00:00Z)
      const NOW_JST_1000 = new Date("2026-09-03T10:00:00+09:00").getTime();

      const result = buildStableTopTradingItems(
        [
          {
            // 2026-09-02T22:00:00Z = JST 2026-09-03 07:00（NOWと同じJST暦日）→ ageDays=0
            title: "INPEX、原油高とLNG需要で決算上方修正",
            snippet: "業績上振れが材料視されています。",
            source: "Market News",
            publishedAt: "2026-09-02T22:00:00.000Z",
            link: "https://example.com/inpex-day0",
          },
          {
            // 2026-09-02T14:00:00Z = JST 2026-09-02 23:00（NOWの前日）→ ageDays=1
            title: "ソフトバンクグループ、決算で上方修正",
            snippet: "業績上振れが材料視されています。",
            source: "Market News",
            publishedAt: "2026-09-02T14:00:00.000Z",
            link: "https://example.com/softbank-day1",
          },
        ],
        { now: NOW_JST_1000 }
      );

      // 両記事とも同じ材料強度（タイトル一致+決算・業績）なので、
      // 順位・スコア差は鮮度加点（day0=+9 vs day1=+6）だけに由来する。
      expect(result.items[0].code).toBe("1605");
      expect(result.items[1].code).toBe("9984");
      expect(result.items[0].confidence).toBeGreaterThan(
        result.items[1].confidence
      );
    });

    it("falls back to the display date string as todays news when publishedAt is absent", () => {
      const result = buildStableTopTradingItems(
        [
          {
            title: "ソニーグループ、決算で上方修正",
            snippet: "業績上振れが材料視されています。",
            source: "Market News",
            date: "2026/9/3",
            link: "https://example.com/sony-date-only-today",
          },
          {
            title: "任天堂、決算で上方修正",
            snippet: "業績上振れが材料視されています。",
            source: "Market News",
            publishedAt: daysAgo(3),
            link: "https://example.com/nintendo-3d",
          },
        ],
        { now: NOW }
      );

      expect(result.items[0].code).toBe("6758");
      expect(result.items[1].code).toBe("7974");
      expect(result.items[0].confidence).toBe(0.94);
      expect(result.items[1].confidence).toBe(0.62);
    });

    it("breaks ties in favor of the stock with the more recently published matching article", () => {
      const result = buildStableTopTradingItems(
        [
          {
            title: "ソニーグループ、決算で上方修正",
            snippet: "業績上振れが材料視されています。",
            source: "Market News",
            publishedAt: new Date(NOW).toISOString(),
            link: "https://example.com/sony-tie-newer",
          },
          {
            title: "トヨタ自動車、決算で上方修正",
            snippet: "業績上振れが材料視されています。",
            source: "Market News",
            publishedAt: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(),
            link: "https://example.com/toyota-tie-older",
          },
        ],
        { now: NOW }
      );

      // 同じ日バケット（ageDays=0）で材料強度も同じなのでスコアは同点。
      // タイブレークで、より新しい時刻の記事を持つ銘柄が上位に来る。
      expect(result.items[0].confidence).toBe(result.items[1].confidence);
      expect(result.items[0].code).toBe("6758");
      expect(result.items[1].code).toBe("7203");
    });

    it("does not accumulate the freshness bonus when a stock is matched by multiple same-day articles", () => {
      const result = buildStableTopTradingItems(
        [
          {
            // 三井E&S: スニペットのみ一致(directHit=6) x 2本、両方とも同日(ageDays=0)
            title: "港湾クレーン関連銘柄に新技術発表の思惑",
            snippet: "三井E&Sが新技術領域に参入するとの観測が出ています。",
            source: "Market News",
            publishedAt: new Date(NOW).toISOString(),
            link: "https://example.com/mitsui-es-a",
          },
          {
            title: "港湾物流関連で新事業立ち上げの報道",
            snippet: "三井E&Sの新事業計画が話題になっています。",
            source: "Market News",
            publishedAt: new Date(NOW).toISOString(),
            link: "https://example.com/mitsui-es-b",
          },
          {
            // 三菱UFJ: タイトル一致(directHit=12) x 1本、同日(ageDays=0)
            title: "三菱UFJ、大型受注を発表",
            snippet: "金利上昇観測も相まって関心を集めています。",
            source: "Market News",
            publishedAt: new Date(NOW).toISOString(),
            link: "https://example.com/mufg-order",
          },
        ],
        { now: NOW }
      );

      // 材料・タイトル一致由来のスコアは三井E&S(6+3)x2=18、三菱UFJ(12+6)=18で
      // 意図的に一致させてある。鮮度加点が記事ごとに累積するなら三井E&Sが
      // +9ぶん上振れて同点は崩れるはずだが、銘柄あたり1回しか加点されない
      // ため両者は同点になる。
      expect(result.items).toHaveLength(2);
      expect(result.items[0].confidence).toBe(result.items[1].confidence);
      expect(new Set(result.items.map(item => item.code))).toEqual(
        new Set(["7003", "8306"])
      );
    });
  });

  it("does not mistake a Google News publisher suffix for a stock mention (フィスコ)", () => {
    const result = buildStableTopTradingItems([
      {
        title:
          "概況からBRICsを知ろう インド株式市場は3日続落…(フィスコ) - Yahoo!ファイナンス",
        snippet:
          "概況からBRICsを知ろう インド株式市場は3日続落…(フィスコ) - Yahoo!ファイナンス",
        source: "Yahoo!ファイナンス",
        date: RECENT_DATE,
        link: "https://example.com/brics-fisco",
      },
    ]);

    expect(result.items.map(item => item.code)).not.toContain("3807");
  });

  it("does not mistake a Google News publisher suffix for a stock mention (note)", () => {
    const result = buildStableTopTradingItems([
      {
        title: "【保存版】ティム・クック退任で…厳選20銘柄 - note",
        snippet: "【保存版】ティム・クック退任で…厳選20銘柄 - note",
        source: "note",
        date: RECENT_DATE,
        link: "https://example.com/tim-cook-note",
      },
    ]);

    expect(result.items.map(item => item.code)).not.toContain("5243");
  });

  it("still surfaces a publisher-name-clash stock when the company is named in the title body", () => {
    const fisco = buildStableTopTradingItems([
      {
        title: "フィスコ、AI分析サービスを開始 - 株探",
        snippet: "フィスコ、AI分析サービスを開始 - 株探",
        source: "株探",
        date: RECENT_DATE,
        link: "https://example.com/fisco-ai",
      },
    ]);
    expect(fisco.items.map(item => item.code)).toContain("3807");

    const note = buildStableTopTradingItems([
      {
        title: "note、有料会員数が過去最高 - 日経",
        snippet: "note、有料会員数が過去最高 - 日経",
        source: "日経",
        date: RECENT_DATE,
        link: "https://example.com/note-record",
      },
    ]);
    expect(note.items.map(item => item.code)).toContain("5243");
  });

  it("does not match a publisher-name-clash stock from a snippet-only mention", () => {
    const result = buildStableTopTradingItems([
      {
        title: "AI企業の決算まとめ、市場は好感",
        snippet: "詳細は(フィスコ)の分析記事を参照。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/ai-earnings-roundup",
      },
    ]);

    expect(result.items.map(item => item.code)).not.toContain("3807");
  });

  // タイトルに社名「トヨタ自動車」自体が含まれていると、括弧除去の有無に関わらず
  // 7203はマッチしてしまい括弧保持を検証したことにならない。社名を含まない
  // 見出しにして、コード括弧の有無だけでマッチが決まる形にする（reviewer指摘S2）。
  it("keeps a trailing stock-code parenthesis such as （7203） intact", () => {
    const result = buildStableTopTradingItems([
      {
        title: "好決算で続伸（7203）",
        snippet: "好決算で続伸（7203）",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/toyota-code-paren",
      },
    ]);

    expect(result.items.map(item => item.code)).toContain("7203");
  });
});

describe("stripPublisherSuffix", () => {
  it("removes a trailing ' - 配信元' suffix", () => {
    expect(stripPublisherSuffix("X - Yahoo!ファイナンス")).toBe("X");
  });

  it("removes a trailing publisher parenthesis left after the dash suffix is stripped", () => {
    expect(stripPublisherSuffix("X (フィスコ) - Yahoo!ファイナンス")).toBe("X");
  });

  it("removes a trailing full-width publisher parenthesis with no dash suffix", () => {
    expect(stripPublisherSuffix("X（株探）")).toBe("X");
  });

  it("removes a trailing ' - note' suffix", () => {
    expect(stripPublisherSuffix("X - note")).toBe("X");
  });

  it("returns the original string when there is no publisher suffix", () => {
    expect(stripPublisherSuffix("トヨタ自動車、好決算で続伸")).toBe(
      "トヨタ自動車、好決算で続伸"
    );
  });

  it("does not throw on a string that is only a dash", () => {
    expect(() => stripPublisherSuffix(" - ")).not.toThrow();
  });

  it("keeps a stock-code parenthesis such as （7203） intact (NFKC normalizes the bracket width, but the content is preserved)", () => {
    expect(stripPublisherSuffix("トヨタ自動車、好決算で続伸（7203）")).toBe(
      "トヨタ自動車、好決算で続伸(7203)"
    );
  });

  // reviewer指摘S1: 配信元名にハイフンが含まれる場合や、区切りが複数回現れる場合でも
  // 「最後の ' - '」を境目に正しく分割できること。
  it("splits at the last ' - ' when the title itself contains a dash-separated clause", () => {
    expect(stripPublisherSuffix("トヨタ - ホンダ提携 - 日経")).toBe(
      "トヨタ - ホンダ提携"
    );
  });

  it("strips the suffix even when the publisher name itself contains a hyphen (J-CAST)", () => {
    expect(stripPublisherSuffix("X - J-CASTニュース")).toBe("X");
  });

  // N5: 末尾ダッシュの除去は媒体名リストに依存せず無条件に行う現仕様の明文化。
  // 「ソシオネクストは急伸」は媒体名ではないが、末尾の ' - X' 定型として落ちる。
  it("strips the trailing ' - X' segment unconditionally, even when it is not a publisher name", () => {
    expect(
      stripPublisherSuffix("半導体関連が上昇 - ソシオネクストは急伸")
    ).toBe("半導体関連が上昇");
  });

  // reviewer指摘S1の再現バグ: 旧実装では配信元名にハイフンが含まれると
  // ダッシュ除去に失敗し、連鎖して括弧除去も失敗していた。
  it("strips both the dash suffix and the now-trailing publisher parenthesis when the suffix contains a hyphen", () => {
    // 「…」(U+2026) はNFKCで「...」(半角3ドット)に変換されるため、期待値もそれに合わせる。
    expect(
      stripPublisherSuffix(
        "概況からBRICsを知ろう インド株式市場は3日続落…(フィスコ) - J-CASTニュース"
      )
    ).toBe("概況からBRICsを知ろう インド株式市場は3日続落...");
  });

  // reviewer指摘S3: 括弧の中身「全体」が媒体名文法に一致する場合のみ除去する。
  it.each([
    ["テスト銘柄(フィスコ)", "テスト銘柄"],
    ["テスト銘柄(株探ニュース)", "テスト銘柄"],
    ["テスト銘柄(Yahoo!ファイナンス)", "テスト銘柄"],
    ["テスト銘柄(ダイヤモンド・オンライン)", "テスト銘柄"],
    ["テスト銘柄(日経新聞)", "テスト銘柄"],
    ["テスト銘柄(MINKABU PRESS)", "テスト銘柄"],
  ])("removes the trailing publisher parenthesis in %s", (input, expected) => {
    expect(stripPublisherSuffix(input)).toBe(expected);
  });

  it.each([
    ["テスト銘柄(日経平均採用銘柄)", "テスト銘柄(日経平均採用銘柄)"],
    ["テスト銘柄(7203)", "テスト銘柄(7203)"],
  ])(
    "keeps a legitimate trailing parenthesis intact in %s",
    (input, expected) => {
      expect(stripPublisherSuffix(input)).toBe(expected);
    }
  );

  // reviewer指摘N-b: 末尾に非媒体名の括弧が続く場合でも、その手前にある
  // 媒体名括弧だけを間引いて残りは元の順序で保持する。
  it("removes only the publisher parenthesis when it precedes a non-publisher parenthesis", () => {
    expect(
      stripPublisherSuffix("X(フィスコ)(3月14日) - Yahoo!ファイナンス")
    ).toBe("X(3月14日)");
  });

  it("removes only the publisher parenthesis when it follows a non-publisher parenthesis", () => {
    expect(stripPublisherSuffix("X(3月14日)(フィスコ)")).toBe("X(3月14日)");
  });
});
