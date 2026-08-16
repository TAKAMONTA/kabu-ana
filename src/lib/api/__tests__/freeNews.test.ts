import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FreeNewsClient } from "../freeNews";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

const YAHOO_URL = "query1.finance.yahoo.com";
const GOOGLE_RSS_URL = "news.google.com/rss/search";
const EMPTY_RSS = "<rss><channel></channel></rss>";
const DUP_LINK = "https://example.com/dup";

const buildYahooNews = (titles: string[]) =>
  titles.map((title, index) => ({
    title,
    summary: title,
    // 同一日に収まるよう1分刻みでずらす
    providerPublishTime: 1786000000 - index * 60,
    publisher: "Yahoo Finance",
    link: `https://example.com/yahoo/${index}`,
  }));

/** CDATA形式のRSS */
const buildRss = (titles: string[]) =>
  `<rss><channel>${titles
    .map(
      (title, index) =>
        `<item><title><![CDATA[${title}]]></title>` +
        `<link>https://example.com/rss/${index}</link>` +
        `<pubDate>Mon, 10 Aug 2026 09:00:00 GMT</pubDate></item>`
    )
    .join("")}</channel></rss>`;

/** 実際のGoogle News RSSと同じ非CDATA＋HTMLエンティティ形式のRSS */
const buildPlainRss = (titles: string[]) =>
  `<rss><channel>${titles
    .map(
      (title, index) =>
        `<item><title>${title}</title>` +
        `<link>https://example.com/rss/${index}</link>` +
        `<pubDate>Mon, 10 Aug 2026 09:00:00 GMT</pubDate></item>`
    )
    .join("")}</channel></rss>`;

/** Yahoo Finance / Google RSS の2系統にaxios.getを振り分ける */
const mockSources = (yahooTitles: string[], rssXml: string = EMPTY_RSS) => {
  const get = vi.mocked(axios.get);
  get.mockImplementation((url: unknown) => {
    const target = String(url);
    if (target.includes(YAHOO_URL)) {
      return Promise.resolve({ data: { news: buildYahooNews(yahooTitles) } });
    }
    if (target.includes(GOOGLE_RSS_URL)) {
      return Promise.resolve({ data: rssXml });
    }
    return Promise.resolve({ data: {} });
  });
  return get;
};

const callsTo = (get: ReturnType<typeof mockSources>, fragment: string) =>
  get.mock.calls.filter(call => String(call[0]).includes(fragment));

const timeoutOf = (call: unknown[]) =>
  (call[1] as { timeout?: number } | undefined)?.timeout;

const titlesOf = (items: { title: string }[]) => items.map(item => item.title);

describe("FreeNewsClient.getComprehensiveNews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ETFの4桁コードが偶然含まれるだけの記事を除外する（回帰）", async () => {
    const brevo =
      "Brevo Named No. 1306 on the 2026 Inc. 5000 List, the Most Prestigious Ranking of America's Fastest-Growing Private Companies";
    mockSources([brevo, "Global markets steady ahead of the Fed decision"]);

    const client = new FreeNewsClient();
    // ETFはJPXマスタに名前が無く query === symbol === "1306" になる
    const news = await client.getComprehensiveNews("1306", "1306", 10);

    expect(titlesOf(news)).not.toContain(brevo);
    expect(news).toHaveLength(0);
  });

  it("銘柄コードとして書かれた4桁コードは通す", async () => {
    const titles = [
      "Toyota Motor (TSE:7203) reports quarterly results",
      "Toyota shares 7203.T climb on strong guidance",
      "【7203】トヨタ自動車、通期見通しを上方修正",
    ];
    mockSources(titles);

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews("", "7203", 10);

    expect(titlesOf(news).sort()).toEqual([...titles].sort());
  });

  it("コード表記の全バリエーションを通す", async () => {
    const titles = [
      "TYO: 7203 Toyota extends gains",
      "JPX：7203 の売買代金が急増",
      "JP:7203 leads the Nikkei",
      "Toyota (7203.JP) upgraded to buy",
      "7203:JT Toyota Motor Corp",
      "7203 JP Equity trades higher",
      "（7203）トヨタ、増配へ",
      "〈7203〉自社株買いを発表",
      "「7203」トヨタの目標株価",
      "{7203} Toyota note",
      "<7203> Toyota buyback",
      "[7203] Toyota outlook",
      "［7203］トヨタ、決算説明会",
      "証券コード7203の値動き",
      "銘柄コード: 7203 を追加",
      "東証 7203 が年初来高値",
      "コード7203に注目",
    ];
    mockSources(titles);

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews("", "7203", titles.length);

    expect(titlesOf(news).sort()).toEqual([...titles].sort());
  });

  it("マーカー直前が数字でも取りこぼさない", async () => {
    const titles = [
      "第2四半期2026(7203)トヨタ決算",
      "日経225<7203>",
      "TOPIX30(7203)",
      "1TSE:7203",
      "日経225採用<7203>トヨタが上昇",
    ];
    mockSources(titles);

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews("", "7203", titles.length);

    expect(titlesOf(news).sort()).toEqual([...titles].sort());
  });

  it("全角数字のコード表記も通す", async () => {
    const titles = [
      "トヨタ自動車（７２０３）が最高値",
      "証券コード７２０３の値動き",
    ];
    mockSources(titles);

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews("", "7203", 10);

    expect(titlesOf(news).sort()).toEqual([...titles].sort());
  });

  it("マーカー付きでも桁がずれていれば通さない", async () => {
    mockSources([
      "TSE:13060 unrelated code",
      "(11306) another code",
      "13060.T is a different ticker",
      "コード11306の記事",
      "1306 JPY weakens",
    ]);

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews("", "1306", 10);

    expect(news).toHaveLength(0);
  });

  it("4桁コードの偶然一致は通さない", async () => {
    mockSources([
      "読売333終値、1306円安",
      "しまむら、1,306店舗に拡大",
      "Sales reached 11306 units",
    ]);

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews("", "1306", 10);

    expect(news).toHaveLength(0);
  });

  it("4桁以外の数値symbolにもマーカーを要求する", async () => {
    mockSources(["Sales reached 72030 units", "トヨタ(72030)の適時開示"]);

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews("", "72030", 10);

    expect(titlesOf(news)).toEqual(["トヨタ(72030)の適時開示"]);
  });

  it("コード+取引所サフィックス形式のsymbolも数字部分で判定する", async () => {
    mockSources([
      "Toyota Motor (TSE:7203) reports quarterly results",
      "Sales reached 7203 units",
    ]);

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews("", "7203.T", 10);

    expect(titlesOf(news)).toEqual([
      "Toyota Motor (TSE:7203) reports quarterly results",
    ]);
  });

  it("symbol未指定でもコード表記のqueryを識別子として扱う", async () => {
    mockSources(
      [],
      buildRss([
        "NEXT FUNDS TOPIX連動型上場投信[1306] 分配金のお知らせ",
        "【1306】運用report公表",
        "#1306 激辛グルメ紀行",
      ])
    );

    const client = new FreeNewsClient();
    // コード表記の query が symbol 無しで渡ってきた場合の分岐検証
    // （isCodeLikeQuery が identifier に昇格し、文脈マーカー必須で照合される）
    const news = await client.getComprehensiveNews("1306", undefined, 10);

    expect(titlesOf(news).sort()).toEqual([
      "NEXT FUNDS TOPIX連動型上場投信[1306] 分配金のお知らせ",
      "【1306】運用report公表",
    ]);
  });

  it("英字ティッカーは単語境界で一致させる", async () => {
    mockSources(["AAPL rises 3% after earnings", "SNAAPLE launches a new app"]);

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews("", "AAPL", 10);

    expect(titlesOf(news)).toEqual(["AAPL rises 3% after earnings"]);
  });

  it("米国株の本番経路（query===symbol）でも単語境界が効く", async () => {
    const titles = [
      "AAPL rises 3% after earnings",
      "アップル（AAPL）が最高値を更新",
      "Apple（AAPL）の出荷が加速",
      "$アップル (AAPL.US)$ の出来高が増加",
    ];
    mockSources([...titles, "SNAAPLE launches a new app"]);

    const client = new FreeNewsClient();
    // twelveData.ts の getCompanyNews（query===symbol）の経路
    const news = await client.getComprehensiveNews("AAPL", "AAPL", 10);

    expect(titlesOf(news).sort()).toEqual([...titles].sort());
    expect(titlesOf(news)).not.toContain("SNAAPLE launches a new app");
  });

  it("英字ティッカーは数字が直結していても通す", async () => {
    mockSources(["Netflix4-6月期は増収", "SNETFLIXER launches"]);

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews("Netflix", "Netflix", 10);

    expect(titlesOf(news)).toEqual(["Netflix4-6月期は増収"]);
  });

  it("非ASCII識別子には単語境界を適用しない", async () => {
    mockSources(["ネットフリックス4-6月期決算、最高益"]);

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews(
      "ネットフリックス",
      "ネットフリックス",
      10
    );

    expect(titlesOf(news)).toEqual(["ネットフリックス4-6月期決算、最高益"]);
  });

  it("非ASCII識別子は直前にASCII英字があっても通す", async () => {
    mockSources(["EVトヨタ、新型車を発表"]);

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews("トヨタ", "トヨタ", 10);

    expect(titlesOf(news)).toEqual(["EVトヨタ、新型車を発表"]);
  });

  it("企業名一致は従来どおり通す", async () => {
    mockSources(
      [],
      buildRss(["トヨタ自動車が新型EVを発表", "任天堂、新型ハードを発表"])
    );

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews(
      "トヨタ自動車",
      undefined,
      10
    );

    expect(titlesOf(news)).toEqual(["トヨタ自動車が新型EVを発表"]);
  });

  it("全角のJPX名称（未正規化）のqueryでも半角記事に一致する", async () => {
    // getCompanyNewsByName はJPXマスタの表示名をnormalizeDisplayTextせず
    // そのまま渡す実経路がある（jquants.tsのgetCompanyNewsByName）。
    // NFKC正規化は両側にかかるため、queryが全角のままでも半角記事に一致する
    mockSources(
      [],
      buildRss(["JESCOホールディングスが上昇", "無関係な別のニュース"])
    );

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews(
      "ＪＥＳＣＯホールディングス",
      undefined,
      10
    );

    expect(titlesOf(news)).toEqual(["JESCOホールディングスが上昇"]);
  });

  it("非CDATAのRSSタイトルをHTMLエンティティごとデコードする", async () => {
    mockSources(
      [],
      buildPlainRss([
        "AT&amp;T partners with Toyota - 日経",
        "&quot;Nintendo&quot; &#39;posts&#39; &lt;record&gt; profit - ITmedia",
      ])
    );

    const client = new FreeNewsClient();
    const atnt = await client.getComprehensiveNews("AT&T", undefined, 10);
    expect(titlesOf(atnt)).toEqual(["AT&T partners with Toyota - 日経"]);

    const nintendo = await client.getComprehensiveNews(
      "Nintendo",
      undefined,
      10
    );
    expect(titlesOf(nintendo)).toEqual([
      "\"Nintendo\" 'posts' <record> profit - ITmedia",
    ]);
  });

  it("多段エンコードされたエンティティを再デコードしない", async () => {
    mockSources([], buildPlainRss(["Toyota &#38;lt;script&#38;gt; 検証"]));

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews("Toyota", undefined, 10);

    expect(titlesOf(news)).toEqual(["Toyota &lt;script&gt; 検証"]);
  });

  it("2ソースを並列に発行し、Yahooがlimit件返してもGoogle RSSを取得する", async () => {
    const irrelevant = Array.from(
      { length: 10 },
      (_, index) => `Unrelated market wrap ${index}`
    );
    const get = mockSources(
      irrelevant,
      buildRss(["トヨタ自動車、電池新工場の稼働を開始"])
    );

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews("トヨタ自動車", "7203", 10);

    // 修正前は生件数10 < limit10 が偽になりRSSが呼ばれなかった
    expect(callsTo(get, YAHOO_URL)).toHaveLength(1);
    expect(callsTo(get, GOOGLE_RSS_URL)).toHaveLength(1);
    expect(titlesOf(news)).toEqual(["トヨタ自動車、電池新工場の稼働を開始"]);
  });

  it("同一linkはYahooがRSSより優先される（先勝ち）", async () => {
    const get = vi.mocked(axios.get);
    get.mockImplementation((url: unknown) => {
      const target = String(url);
      if (target.includes(YAHOO_URL)) {
        return Promise.resolve({
          data: {
            news: [
              {
                title: "トヨタ自動車の決算記事",
                summary: "s",
                publisher: "Yahoo Finance",
                providerPublishTime: 1786000000,
                link: DUP_LINK,
              },
            ],
          },
        });
      }
      return Promise.resolve({
        data:
          `<rss><channel><item><title><![CDATA[トヨタ自動車の決算記事]]></title>` +
          `<link>${DUP_LINK}</link>` +
          `<pubDate>Mon, 10 Aug 2026 09:00:00 GMT</pubDate></item></channel></rss>`,
      });
    });

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews("トヨタ自動車", "7203", 10);

    expect(news).toHaveLength(1);
    expect(news[0].source).toBe("Yahoo Finance");
  });

  it("日付不明の記事はソートで最後尾に回る", async () => {
    // pubDate欠落 → date:"不明" → new Date("不明").getTime() が NaN になる
    mockSources(
      [],
      `<rss><channel>` +
        `<item><title><![CDATA[トヨタ自動車、日付不明の記事]]></title>` +
        `<link>https://example.com/rss/nodate</link></item>` +
        `<item><title><![CDATA[トヨタ自動車、日付ありの記事]]></title>` +
        `<link>https://example.com/rss/dated</link>` +
        `<pubDate>Mon, 10 Aug 2026 09:00:00 GMT</pubDate></item>` +
        `</channel></rss>`
    );

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews(
      "トヨタ自動車",
      undefined,
      10
    );

    expect(titlesOf(news)).toEqual([
      "トヨタ自動車、日付ありの記事",
      "トヨタ自動車、日付不明の記事",
    ]);
    expect(news[1].date).toBe("不明");
  });

  it("Yahoo取得が例外を投げても他ソースの結果を返す", async () => {
    mockSources([], buildRss(["トヨタ自動車、通期予想を上方修正"]));

    const client = new FreeNewsClient();
    // 内部catchを迂回してPromise.allSettledのrejected分岐を踏ませる
    const spy = vi
      .spyOn(client, "getNewsFromYahooFinance")
      .mockRejectedValue(new Error("yahoo exploded"));

    const news = await client.getComprehensiveNews("トヨタ自動車", "7203", 10);

    expect(spy).toHaveBeenCalled();
    expect(titlesOf(news)).toEqual(["トヨタ自動車、通期予想を上方修正"]);
    spy.mockRestore();
  });

  it("axiosがrejectしても他ソースの結果を返す", async () => {
    const get = vi.mocked(axios.get);
    get.mockImplementation((url: unknown) => {
      const target = String(url);
      if (target.includes(YAHOO_URL)) {
        return Promise.reject(new Error("yahoo down"));
      }
      return Promise.resolve({
        data: buildRss(["トヨタ自動車、通期予想を上方修正"]),
      });
    });

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews("トヨタ自動車", "7203", 10);

    expect(titlesOf(news)).toEqual(["トヨタ自動車、通期予想を上方修正"]);
  });

  it("並列取得は1500msのタイムアウトを使う", async () => {
    const get = mockSources(["Toyota Motor (TSE:7203) update"]);

    const client = new FreeNewsClient();
    await client.getComprehensiveNews("トヨタ自動車", "7203", 10);

    const configs = get.mock.calls.map(timeoutOf);
    expect(configs.length).toBeGreaterThan(0);
    configs.forEach(timeout => expect(timeout).toBe(1500));
  });

  it("空クエリではGoogle RSSを叩かない", async () => {
    const get = mockSources(["Toyota Motor (TSE:7203) update"]);

    const client = new FreeNewsClient();
    await client.getComprehensiveNews("", "7203", 10);

    expect(callsTo(get, YAHOO_URL)).toHaveLength(1);
    expect(callsTo(get, GOOGLE_RSS_URL)).toHaveLength(0);
  });

  it("空白のみのquery・symbolでは外部リクエストを一切発火せず空を返す", async () => {
    // news-analysis/route.ts側でも {"symbol":" ","companyName":" "} は
    // trim後に空となり400で弾かれるが、freeNews単体でも空白入力を渡された場合に
    // 外部（Yahoo/Google RSS）を叩かないことを二重防御として保証する。
    // hasSymbol/hasQueryのtrim判定が対称化されたことで、空白のみのsymbolも
    // Yahoo分岐をスキップするようになった
    const get = mockSources(["日経平均、続伸", "米国株はまちまち"]);

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews(" ", " ", 10);

    expect(callsTo(get, YAHOO_URL)).toHaveLength(0);
    expect(callsTo(get, GOOGLE_RSS_URL)).toHaveLength(0);
    expect(news).toEqual([]);
  });

  it("極端に長い識別子では外部リクエストを行わず空を返す", async () => {
    const get = mockSources(["何かのニュース"], buildRss(["何かのニュース"]));

    const client = new FreeNewsClient();
    // コード表記かつMAX_SYMBOL_LENGTH超過 → 判定材料ゼロが確定する
    const news = await client.getComprehensiveNews(
      "1".repeat(17),
      undefined,
      10
    );

    expect(news).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  it("空クエリ＋極端に長いsymbolでも外部リクエストを行わず空を返す（回帰）", async () => {
    const get = mockSources(["何かのニュース"], buildRss(["何かのニュース"]));

    const client = new FreeNewsClient();
    // query空文字・symbolがMAX_SYMBOL_LENGTH超過 → buildSymbolPatternがnullになり
    // 判定材料ゼロが確定する。修正前はここが「判定材料なし＝全件通す」に
    // 誤って倒れ、Yahooの無関係記事が無検査で返っていた
    const news = await client.getComprehensiveNews("", "A".repeat(20), 10);

    expect(news).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  it("長すぎるsymbolでも名前一致は生き残る", async () => {
    mockSources([], buildRss(["トヨタ自動車、通期予想を上方修正"]));

    const client = new FreeNewsClient();
    const news = await client.getComprehensiveNews(
      "トヨタ自動車",
      "1".repeat(50000),
      10
    );

    expect(titlesOf(news)).toEqual(["トヨタ自動車、通期予想を上方修正"]);
  });
});

describe("FreeNewsClient.getNewsFromGoogleRSS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("引数2つの単発呼び出しには3500msの既定タイムアウトを使う", async () => {
    const get = mockSources([], buildRss(["市場サマリー"]));

    const client = new FreeNewsClient();
    // top-trading-value/route.ts の fetchMarketNews と同じ呼び方
    // （NEWS_FETCH_TIMEOUT_MS=4000 ラッパーの内側で先に切れる）
    await client.getNewsFromGoogleRSS("日本株 個別銘柄 材料", 8);

    const calls = callsTo(get, GOOGLE_RSS_URL);
    expect(calls).toHaveLength(1);
    expect(timeoutOf(calls[0])).toBe(3500);
  });

  it("同一クエリの同時リクエストを1本に集約する", async () => {
    const get = mockSources([], buildRss(["トヨタ自動車、決算を発表"]));

    const client = new FreeNewsClient();
    const [first, second] = await Promise.all([
      client.getNewsFromGoogleRSS("トヨタ自動車", 5),
      client.getNewsFromGoogleRSS("トヨタ自動車", 5),
    ]);

    expect(callsTo(get, GOOGLE_RSS_URL)).toHaveLength(1);
    expect(titlesOf(first)).toEqual(["トヨタ自動車、決算を発表"]);
    expect(titlesOf(second)).toEqual(["トヨタ自動車、決算を発表"]);
    // 配列インスタンスは共有しない（要素は共有）
    expect(first).not.toBe(second);
  });

  it("タイムアウトが異なる同一クエリは集約しない", async () => {
    const get = mockSources([], buildRss(["市場サマリー"]));

    const client = new FreeNewsClient();
    await Promise.all([
      client.getNewsFromGoogleRSS("トヨタ自動車", 5),
      client.getNewsFromGoogleRSS("トヨタ自動車", 5, 1500),
    ]);

    expect(callsTo(get, GOOGLE_RSS_URL)).toHaveLength(2);
  });

  it("異なるクエリは集約しない", async () => {
    const get = mockSources([], buildRss(["市場サマリー"]));

    const client = new FreeNewsClient();
    await Promise.all([
      client.getNewsFromGoogleRSS("トヨタ自動車", 5),
      client.getNewsFromGoogleRSS("ソニーグループ", 5),
    ]);

    expect(callsTo(get, GOOGLE_RSS_URL)).toHaveLength(2);
  });

  it("完了後の再リクエストは新たに取得する（TTLキャッシュではない）", async () => {
    const get = mockSources([], buildRss(["市場サマリー"]));

    const client = new FreeNewsClient();
    await client.getNewsFromGoogleRSS("トヨタ自動車", 5);
    await client.getNewsFromGoogleRSS("トヨタ自動車", 5);

    expect(callsTo(get, GOOGLE_RSS_URL)).toHaveLength(2);
  });

  it("search/route.tsのようにsymbol有無2経路が同時に走ってもRSSは1本", async () => {
    const get = mockSources(
      ["Toyota Motor (TSE:7203) update"],
      buildRss(["トヨタ自動車、決算を発表"])
    );

    // jquants.ts の JQuantsClient（freeNewsフィールド）と同様に単一インスタンスを共有する
    const client = new FreeNewsClient();
    await Promise.all([
      client.getComprehensiveNews("トヨタ自動車", "7203", 5),
      client.getComprehensiveNews("トヨタ自動車", undefined, 5),
    ]);

    expect(callsTo(get, GOOGLE_RSS_URL)).toHaveLength(1);
  });
});
