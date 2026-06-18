import { describe, expect, it } from "vitest";
import { buildStableTopTradingItems } from "../topTradingValue";

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
        snippet: "東京エレクトロンやアドバンテストなどAI半導体関連が物色されています。",
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
        item.sources.includes("ソニーグループ、イメージセンサーとゲーム事業が好調")
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
    expect(result.items[0].sources[0]).toBe("三菱重工、防衛関連の大型受注で注目");
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
        title:
          "日本高純度化学、オービーシステムに注目 好業績と増配が材料",
        snippet: "高配当と好業績を背景に2銘柄が取り上げられています。",
        source: "Market News",
        date: RECENT_DATE,
        link: "https://example.com/dividend-two",
      },
      {
        title:
          "ローツェ、積水ハウスに注目 AI需要と米国事業の成長期待",
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
    expect(codes.filter(code => ["4973", "5576"].includes(code))).toHaveLength(1);
    expect(codes.filter(code => ["6323", "1928"].includes(code))).toHaveLength(1);
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
    expect(codes.filter(code => ["4973", "5576"].includes(code))).toHaveLength(1);
    expect(codes.filter(code => ["6323", "1928"].includes(code))).toHaveLength(1);
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
    expect(result.items[0].confidence).toBeGreaterThan(result.items[1].confidence);
    expect(Math.max(...confidences)).toBeLessThanOrEqual(0.94);
  });
});
