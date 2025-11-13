import axios from "axios";

export interface NewsItem {
  title: string;
  snippet: string;
  source: string;
  date: string;
  link: string;
}

export class FreeNewsClient {
  /**
   * NewsAPIを使用してニュースを取得（無料プラン: 100リクエスト/日）
   */
  async getNewsFromNewsAPI(
    query: string,
    limit: number = 10
  ): Promise<NewsItem[]> {
    try {
      const apiKey = process.env.NEWSAPI_API_KEY;
      if (!apiKey || apiKey === "your_newsapi_key_here") {
        return [];
      }

      // より具体的な検索クエリを作成
      const searchQuery = `"${query}" AND (株価 OR 決算 OR 業績 OR ニュース)`;

      const response = await axios.get("https://newsapi.org/v2/everything", {
        params: {
          q: searchQuery,
          apiKey,
          language: "ja",
          sortBy: "publishedAt",
          pageSize: limit * 2, // フィルタリング前により多くの結果を取得
          from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 過去1週間
        },
      });

      return (
        response.data.articles?.map((article: any) => ({
          title: article.title,
          snippet: article.description || article.title,
          source: article.source.name,
          date: new Date(article.publishedAt).toLocaleDateString("ja-JP"),
          link: article.url,
        })) || []
      );
    } catch (error: any) {
      console.error("NewsAPI取得エラー:", error.message);
      return [];
    }
  }

  /**
   * Google News RSSを使用してニュースを取得（完全無料）
   */
  async getNewsFromGoogleRSS(
    query: string,
    limit: number = 10
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
    const allNews: NewsItem[] = [];

    try {
      // 1. NewsAPI（APIキーがある場合）
      const newsApiResults = await this.getNewsFromNewsAPI(query, limit);
      allNews.push(...newsApiResults);

      // 2. Yahoo Finance（シンボルがある場合）
      if (symbol) {
        const yahooResults = await this.getNewsFromYahooFinance(symbol, limit);
        allNews.push(...yahooResults);
      }

      // 3. Google RSS（フォールバック）
      if (allNews.length < limit) {
        const googleResults = await this.getNewsFromGoogleRSS(query, limit);
        allNews.push(...googleResults);
      }

      // 重複を除去
      const uniqueNews = allNews.filter(
        (item, index, self) =>
          index === self.findIndex(t => t.link === item.link)
      );

      const normalizedKeywords = query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

      const relevantNews = uniqueNews.filter(item => {
        const title = (item.title || "").toLowerCase();
        const snippet = (item.snippet || "").toLowerCase();
        const symbolLower = symbol ? symbol.toLowerCase() : "";

        const matchesKeyword =
          normalizedKeywords.length === 0 ||
          normalizedKeywords.every(keyword =>
            title.includes(keyword) || snippet.includes(keyword)
          );

        const matchesSymbol =
          symbolLower &&
          (title.includes(symbolLower) || snippet.includes(symbolLower));

        return matchesKeyword || matchesSymbol;
      });

      // 日付順にソート（直近のニュースを優先）
      const sortedNews = relevantNews.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA; // 新しい日付を優先
      });

      return sortedNews.slice(0, limit);
    } catch (error: any) {
      console.error("統合ニュース取得エラー:", error.message);
      return [];
    }
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
          items.push({
            title: titleMatch[1],
            snippet: titleMatch[1],
            source: "Google News",
            date: pubDateMatch
              ? new Date(pubDateMatch[1]).toLocaleDateString("ja-JP")
              : "不明",
            link: linkMatch[1],
          });
        }
      }

      return items;
    } catch (error) {
      console.error("RSSパースエラー:", error);
      return [];
    }
  }
}
