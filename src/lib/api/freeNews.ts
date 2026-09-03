import axios from "axios";

export interface NewsItem {
  title: string;
  snippet: string;
  source: string;
  date: string;
  link: string;
  /**
   * pubDateがパース可能だった場合のみ設定するISO 8601(UTC)の発行時刻。
   * dateは表示用にtoLocaleDateString("ja-JP")でローカル日付化されており、
   * 実行環境のタイムゾーンによって日付境界が変わってしまう。JST基準の
   * 日次バケット計算（topTradingValue.tsのfreshnessBonus）はこちらを優先する。
   */
  publishedAt?: string;
}

// getComprehensiveNewsの並列取得用。
// search/route.ts の NEWS_OPTIONAL_TIMEOUT_MS=1800 の内側で先に切れる値
const NEWS_FETCH_TIMEOUT_MS = 1500;

// 単発呼び出し用の既定値。
// top-trading-value/route.ts の NEWS_FETCH_TIMEOUT_MS=4000 ラッパーの内側で先に切れる値
const NEWS_STANDALONE_TIMEOUT_MS = 3500;

// 識別子の長さ上限。銘柄コード・ティッカーは十分収まる。
// 巨大なsymbolで正規表現ソースが肥大するのを防ぐ
const MAX_SYMBOL_LENGTH = 16;

/** 全角英数・全角記号を吸収して照合用に正規化する（jquants.tsのextract4と同じNFKC） */
const normalizeForMatch = (value: string): string =>
  (value || "").normalize("NFKC");

/** 正規表現メタ文字をエスケープ */
const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class FreeNewsClient {
  /** 進行中のGoogle RSSリクエスト（同一クエリの同時実行を1本に集約する） */
  private inFlightGoogleRSS = new Map<string, Promise<NewsItem[]>>();

  /**
   * Google News RSSを使用してニュースを取得（完全無料）
   * 同一クエリのリクエストが進行中ならそのPromiseを共有し、429を招く重複発火を防ぐ
   * timeoutMsの既定値は単発呼び出し向け。getComprehensiveNewsからは短い値を明示的に渡す
   */
  async getNewsFromGoogleRSS(
    query: string,
    limit: number = 10,
    timeoutMs: number = NEWS_STANDALONE_TIMEOUT_MS
  ): Promise<NewsItem[]> {
    // タイムアウトが異なる呼び出し同士を共有すると意図しない打ち切りを被るためキーに含める
    const key = `${query}::${limit}::${timeoutMs}`;
    const shared = this.inFlightGoogleRSS.get(key);
    if (shared) {
      // コピーするのは配列インスタンスのみ（NewsItem要素は共有）
      return [...(await shared)];
    }

    const request = this.fetchGoogleRSS(query, limit, timeoutMs);
    this.inFlightGoogleRSS.set(key, request);
    try {
      return [...(await request)];
    } finally {
      this.inFlightGoogleRSS.delete(key);
    }
  }

  /**
   * Google News RSSの実取得処理
   */
  private async fetchGoogleRSS(
    query: string,
    limit: number,
    timeoutMs: number
  ): Promise<NewsItem[]> {
    try {
      // Google NewsのRSSフィードを検索
      const searchQuery = encodeURIComponent(query);
      const rssUrl = `https://news.google.com/rss/search?q=${searchQuery}&hl=ja&gl=JP&ceid=JP:ja`;

      const response = await axios.get(rssUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: timeoutMs,
      });

      // RSSフィードをパース（簡易版）
      const items = this.parseRSSFeed(response.data);
      return items.slice(0, limit);
    } catch (error: any) {
      console.error("Google RSS取得エラー:", error.message);
      return [];
    }
  }

  /**
   * Yahoo Financeのニュースを取得（無料）
   */
  async getNewsFromYahooFinance(
    symbol: string,
    limit: number = 10
  ): Promise<NewsItem[]> {
    try {
      const response = await axios.get(
        `https://query1.finance.yahoo.com/v1/finance/search`,
        {
          params: {
            q: symbol,
            quotesCount: 1,
            newsCount: limit,
            enableFuzzyQuery: false,
            quotesQueryId: "tss_match_phrase_query",
            multiQuoteQueryId: "multi_quote_single_token_query",
            newsQueryId: "news_cie_vespa",
            enableCb: true,
            enableNavLinks: true,
            enableEnhancedTrivialQuery: true,
          },
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          timeout: NEWS_FETCH_TIMEOUT_MS,
        }
      );

      return (
        response.data.news?.map((item: any) => ({
          title: item.title,
          snippet: item.summary || item.title,
          source: item.publisher,
          date: new Date(item.providerPublishTime * 1000).toLocaleDateString(
            "ja-JP"
          ),
          link: item.link,
        })) || []
      );
    } catch (error: any) {
      console.error("Yahoo Finance取得エラー:", error.message);
      return [];
    }
  }

  /**
   * 複数のソースからニュースを統合取得
   */
  async getComprehensiveNews(
    query: string,
    symbol?: string,
    limit: number = 10
  ): Promise<NewsItem[]> {
    try {
      const isRelevant = this.createRelevanceFilter(query, symbol);

      // 判定材料が無く全件落ちると確定している場合は外部リクエストを行わない
      if (!isRelevant) {
        return [];
      }

      // Google RSS側（hasQuery）と同じtrim基準に揃える。空白のみのsymbolで
      // Yahooへ無意味なリクエストを飛ばさないようにする
      const trimmedSymbol = (symbol ?? "").trim();
      const hasSymbol = trimmedSymbol !== "";
      const hasQuery = (query || "").trim() !== "";

      // 2ソースを並列取得（レイテンシを合計ではなく最大値に抑える）
      // 配列の順序 = 重複除去の優先順位・同日付記事の並び順なので変更しないこと
      const settled = await Promise.allSettled([
        // 1. Yahoo Finance（シンボルがある場合）
        hasSymbol
          ? this.getNewsFromYahooFinance(trimmedSymbol, limit)
          : Promise.resolve<NewsItem[]>([]),
        // 2. Google RSS（空クエリでは一般ニュースしか返らないので叩かない）
        hasQuery
          ? this.getNewsFromGoogleRSS(query, limit, NEWS_FETCH_TIMEOUT_MS)
          : Promise.resolve<NewsItem[]>([]),
      ]);

      // 1ソースが落ちても残りで返す
      const allNews = settled.flatMap(result =>
        result.status === "fulfilled" ? result.value : []
      );

      // 重複を除去してから関連度で絞り込む
      const relevantNews = this.dedupeByLink(allNews).filter(isRelevant);

      // 日付順にソート（直近のニュースを優先）
      const sortedNews = relevantNews.sort((a, b) => {
        // 日付不明（"不明"など）はNaNになるため最後尾に回す
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        const safeA = Number.isNaN(dateA) ? 0 : dateA;
        const safeB = Number.isNaN(dateB) ? 0 : dateB;
        return safeB - safeA; // 新しい日付を優先
      });

      return sortedNews.slice(0, limit);
    } catch (error: any) {
      console.error("統合ニュース取得エラー:", error.message);
      return [];
    }
  }

  /**
   * link基準で重複を除去（先に取得したものを残す）
   */
  private dedupeByLink(items: NewsItem[]): NewsItem[] {
    return items.filter(
      (item, index, self) => index === self.findIndex(t => t.link === item.link)
    );
  }

  /**
   * 銘柄識別子の一致判定用の正規表現を生成
   * 数値コードは無関係な数字と衝突しやすいため、
   * 銘柄コードとして書かれている文脈マーカーを伴う一致のみを有効とする
   */
  private buildSymbolPattern(symbol: string): RegExp | null {
    const normalized = normalizeForMatch(symbol).trim();
    if (!normalized || normalized.length > MAX_SYMBOL_LENGTH) {
      return null;
    }

    // 数値コード、および 7203.T のようなコード+取引所サフィックスは数字部分をコードとして扱う
    const codeMatch = normalized.match(/^(\d+)(?:\.[a-z]{1,4})?$/i);
    if (!codeMatch) {
      // 英字を含むティッカー（米国株など）は単語境界一致で判定。
      // 後方は英字のみ拒否する（"Netflix4-6月期"のような数字直結を落とさないため）。
      // 前方ガードは維持するので "SNAAPLE" は引き続き一致しない
      return new RegExp(
        `(?:^|[^a-z0-9])${escapeRegExp(normalized)}(?![a-z])`,
        "i"
      );
    }

    const code = codeMatch[1];
    // 素の数字で始まるパターンだけ、直前が数字（11306など）でないことを要求する
    const digitStart = "(?:^|[^0-9])";

    // NFKC正規化により（）［］は()[]へ畳まれるが、正規化前の入力にも備えて残す
    const brackets: [string, string][] = [
      ["\\(", "\\)"],
      ["（", "）"],
      ["【", "】"],
      ["〈", "〉"],
      ["「", "」"],
      ["<", ">"],
      ["\\[", "\\]"],
      ["［", "］"],
      ["\\{", "\\}"],
    ];

    const patterns = [
      // 取引所プレフィックス: TSE:7203 / TYO: 7203 / JPX：7203
      `(?:tse|tyo|jpx|jp)\\s*[:：]\\s*${code}(?![0-9])`,
      // ティッカーサフィックス: 7203.T / 7203.JP
      `${digitStart}${code}\\.(?:t|jp)(?![a-z0-9])`,
      // Bloomberg形式: 7203:JT / 7203 JP Equity
      `${digitStart}${code}\\s*[:：]\\s*(?:jt|jp)(?![a-z0-9])`,
      `${digitStart}${code}\\s+jp(?:\\s+equity)?(?![a-z0-9])`,
      // 括弧囲み: (7203) 【7203】 「7203」 など
      ...brackets.map(([open, close]) => `${open}\\s*${code}\\s*${close}`),
      // 日本語のコード表記: 証券コード7203 / 銘柄コード: 7203 / 東証 7203
      `(?:コード|東証)\\s*[:：]?\\s*${code}(?![0-9])`,
    ];

    return new RegExp(`(?:${patterns.join("|")})`, "i");
  }

  /**
   * 銘柄名（query）と銘柄識別子（symbol）で記事を絞り込む判定関数を生成
   * 判定材料が無く全件落ちると確定している場合はnullを返す
   */
  private createRelevanceFilter(
    query: string,
    symbol?: string
  ): ((item: NewsItem) => boolean) | null {
    const normalizedQuery = normalizeForMatch(query).trim();
    const normalizedSymbol = normalizeForMatch(symbol || "").trim();
    // 「1306」「1306.T」のようなコード表記だけのqueryは名前キーワードとして扱わない
    const isCodeLikeQuery = /^\d+(?:\.[a-z]{1,4})?$/i.test(normalizedQuery);
    const nameKeywords = isCodeLikeQuery
      ? []
      : normalizedQuery.toLowerCase().split(/\s+/).filter(Boolean);

    // symbol未指定でもコード表記のqueryは識別子として扱う（ETFのname===code経路）
    const identifier =
      normalizedSymbol || (isCodeLikeQuery ? normalizedQuery : "");
    const symbolPattern = identifier
      ? this.buildSymbolPattern(identifier)
      : null;
    const identifierKeyword = identifier.toLowerCase();
    // ASCII単語境界は日本語識別子に対して意味を成さないため、判定方法を切り替える
    const isAsciiIdentifier = /^[\x20-\x7e]+$/.test(identifier);

    // queryもsymbol（identifier）も判定材料が無い場合のみ、フィルタを適用せず全件通す
    // 注: getComprehensiveNews側でhasQuery/hasSymbolのtrim判定を揃えたため、
    // この分岐が真になる入力（query・symbolとも空/空白のみ）では
    // Yahoo・Google RSSのどちらも発火せず、フィルタ対象の配列が必ず空になる。
    // そのため戻り値自体は152行目のnull判定・180行目の.filterで使われるものの、
    // 中身（常にtrueを返す関数）が結果に影響することは無い（観測上デッド）。
    // 呼び出し元が増えて判定材料無しでフィルタが呼ばれる経路が復活した場合の
    // 最後の防御として、分岐自体は残す
    if (!normalizedQuery && !identifier) {
      return () => true;
    }

    // 名前キーワードも識別子も無い場合は何も通らない。
    // nameKeywordsが空になるのはqueryが空文字（トリム後）かコード表記のときだけで、
    // ここに到達するのは次のいずれかの異常入力に限られる:
    // ・コード表記のqueryがMAX_SYMBOL_LENGTHを超える場合
    // ・queryが空文字で、symbol（identifier）がMAX_SYMBOL_LENGTHを超える場合
    if (nameKeywords.length === 0 && !symbolPattern) {
      return null;
    }

    return item => {
      const title = normalizeForMatch(item.title || "");
      const snippet = normalizeForMatch(item.snippet || "");
      const lowerTitle = title.toLowerCase();
      const lowerSnippet = snippet.toLowerCase();

      const matchesName =
        nameKeywords.length > 0 &&
        nameKeywords.every(keyword => {
          // キーワードが識別子そのもの（米国株のquery===symbol経路）なら単語境界で判定する。
          // 日本語などASCII外の識別子は単語境界が成立しないため部分文字列一致のまま
          if (
            symbolPattern &&
            isAsciiIdentifier &&
            keyword === identifierKeyword
          ) {
            return symbolPattern.test(title) || symbolPattern.test(snippet);
          }
          return lowerTitle.includes(keyword) || lowerSnippet.includes(keyword);
        });

      const matchesSymbol =
        !!symbolPattern &&
        (symbolPattern.test(title) || symbolPattern.test(snippet));

      return matchesName || matchesSymbol;
    };
  }

  /**
   * RSSフィードを簡易パース
   */
  private parseRSSFeed(xmlData: string): NewsItem[] {
    try {
      const items: NewsItem[] = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;

      while ((match = itemRegex.exec(xmlData)) !== null) {
        const itemXml = match[1];
        // CDATA あり/なし両対応
        const titleMatch =
          itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
          itemXml.match(/<title>(.*?)<\/title>/);
        const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
        const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);

        if (titleMatch && linkMatch) {
          // 非CDATAのtitleはHTMLエンティティでエスケープされているためデコードする。
          // linkはデコードしない（dedupeByLinkのキーとtop-trading-valueの出力が変わるため）
          const title = this.decodeHtmlEntities(titleMatch[1]);
          const parsedPubDate = pubDateMatch ? new Date(pubDateMatch[1]) : null;
          // pubDateタグはあってもテキストがパース不能なら"Invalid Date"になりうる。
          // dateにその文字列を混入させないよう、有効な場合のみ使う
          const validPubDate =
            parsedPubDate && Number.isFinite(parsedPubDate.getTime())
              ? parsedPubDate
              : null;
          items.push({
            title,
            snippet: title,
            source: "Google News",
            date: validPubDate
              ? validPubDate.toLocaleDateString("ja-JP")
              : "不明",
            link: linkMatch[1],
            ...(validPubDate
              ? { publishedAt: validPubDate.toISOString() }
              : {}),
          });
        }
      }

      return items;
    } catch (error) {
      console.error("RSSパースエラー:", error);
      return [];
    }
  }

  /**
   * 最小限のHTMLエンティティをデコード
   * 1パスで解決し、&#38;lt; のような多段エンコードを再デコードしない
   */
  private decodeHtmlEntities(text: string): string {
    const named: Record<string, string | undefined> = {
      quot: '"',
      apos: "'",
      lt: "<",
      gt: ">",
      amp: "&",
    };

    return text.replace(
      /&(#\d+|#x[0-9a-f]+|quot|apos|lt|gt|amp);/gi,
      (match: string, entity: string) => {
        const token = entity.toLowerCase();
        if (!token.startsWith("#")) {
          return named[token] ?? match;
        }
        const value = token.startsWith("#x")
          ? parseInt(token.slice(2), 16)
          : Number(token.slice(1));
        return Number.isFinite(value) && value >= 0 && value <= 0x10ffff
          ? String.fromCodePoint(value)
          : match;
      }
    );
  }
}
