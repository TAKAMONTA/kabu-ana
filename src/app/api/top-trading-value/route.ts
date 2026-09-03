import { NextResponse } from "next/server";
import { FreeNewsClient, type NewsItem } from "@/lib/api/freeNews";
import {
  buildStableTopTradingItems,
  normalizeMarketNewsIdentity,
  type TradingValueItem,
} from "@/lib/topTradingValue";

// export const dynamic = "force-dynamic";
export const revalidate = 60 * 30; // 30分ごとに更新

export const dynamic =
  process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

const NEWS_TOPICS = [
  "日本株 急騰 銘柄",
  "日本株 ストップ高 材料",
  "東証 決算 上方修正",
  "日本株 個別銘柄 材料",
  "東京市場 値上がり 個別銘柄",
  "株式 注目株 材料",
];
// Google News RSSは関連度順で返すため、期間演算子を付けないと関連度の高い
// 古い記事が上位を占め続け、buildStableTopTradingItemsの7日フィルタを
// 通した後に残る件数が枯渇する。週末を跨いでも金曜の記事を拾えるよう3日を採用する。
const NEWS_RECENCY_OPERATOR = "when:3d";
// 長期連休などwhen:3dでは記事が枯渇する場合のフォールバック期間演算子
const NEWS_RECENCY_OPERATOR_FALLBACK = "when:7d";
// この件数未満（集約・重複除去後）ならフォールバック期間で再取得する
const MIN_NEWS_COUNT_BEFORE_FALLBACK = 8;
const NEWS_LIMIT_PER_TOPIC = 8;
const NEWS_FETCH_TIMEOUT_MS = 4000;
// フォールバックはコールドパスで直列に追加発火するため、一次取得より
// 短いタイムアウトで切り上げてレイテンシの上振れを抑える
const NEWS_FALLBACK_TIMEOUT_MS = 2000;
const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_TTL_MS = 60 * 60 * 1000;

interface TopTradingPayload {
  items: TradingValueItem[];
  metadata: {
    source: string;
    newsCount: number;
    matchedCount: number;
    generatedAt: string;
    cacheStatus: "miss" | "hit" | "stale";
  };
  warning?: string;
  error?: string;
}

let cachedPayload: TopTradingPayload | null = null;
let cachedAt = 0;
let refreshPromise: Promise<TopTradingPayload> | null = null;

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("news_fetch_timeout")), timeoutMs);
    }),
  ]);

const fetchNewsForTopics = async (
  newsClient: FreeNewsClient,
  recencyOperator: string,
  timeoutMs: number
): Promise<NewsItem[]> => {
  const results = await Promise.allSettled(
    NEWS_TOPICS.map(topic =>
      withTimeout(
        // 内側(axios)のタイムアウトも外側のwithTimeoutと揃える。異なる値だと
        // 外側が先に諦めた後も内側のリクエストだけ生き残ることになる
        newsClient.getNewsFromGoogleRSS(
          `${topic} ${recencyOperator}`,
          NEWS_LIMIT_PER_TOPIC,
          timeoutMs
        ),
        timeoutMs
      )
    )
  );

  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") return result.value;
    console.warn(
      `⚠️ トピック「${NEWS_TOPICS[index]}」のニュース取得失敗:`,
      result.reason
    );
    return [];
  });
};

// Google Newsや転載記事の表記揺れを寄せて重複を除去
const dedupeNews = (news: NewsItem[]): NewsItem[] =>
  Array.from(
    new Map(
      news.map(item => [normalizeMarketNewsIdentity(item), item])
    ).values()
  );

const fetchMarketNews = async () => {
  const newsClient = new FreeNewsClient();
  const primaryNews = dedupeNews(
    await fetchNewsForTopics(
      newsClient,
      NEWS_RECENCY_OPERATOR,
      NEWS_FETCH_TIMEOUT_MS
    )
  );

  if (primaryNews.length >= MIN_NEWS_COUNT_BEFORE_FALLBACK) {
    return primaryNews.slice(0, 40);
  }

  // FreeNewsClient.fetchGoogleRSS は内部で全例外を握り潰して[]を返すため、
  // Promise.allSettledがrejectedになる経路は実質無く、「全トピック失敗」と
  // 「単に件数が少ない」を区別できない。区別できない以上、件数不足なら
  // 理由を問わず常にフォールバックを試みる（長期連休などwhen:3dでの枯渇対策）。
  // フォールバックが全滅・タイムアウトしても一次の結果は失わずに返す
  const fallbackNews = dedupeNews(
    await fetchNewsForTopics(
      newsClient,
      NEWS_RECENCY_OPERATOR_FALLBACK,
      NEWS_FALLBACK_TIMEOUT_MS
    )
  );

  // 一次(when:3d)側を先に並べることで、Map併合時の先勝ちにより一次記事が
  // 40件キャップで切り落とされにくくする
  return dedupeNews([...primaryNews, ...fallbackNews]).slice(0, 40);
};

const warningFor = (
  newsCount: number,
  matchedCount: number
): string | undefined => {
  if (newsCount === 0) return "news_unavailable";
  if (matchedCount === 0) return "news_low_signal";
  if (matchedCount < 5) return "news_partial_signal";
  return undefined;
};

const withCacheStatus = (
  payload: TopTradingPayload,
  cacheStatus: TopTradingPayload["metadata"]["cacheStatus"]
): TopTradingPayload => ({
  ...payload,
  metadata: {
    ...payload.metadata,
    cacheStatus,
  },
});

const refreshTopTradingValue = async (): Promise<TopTradingPayload> => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const news = await fetchMarketNews();
    const stableRanking = buildStableTopTradingItems(news);
    const payload: TopTradingPayload = {
      items: stableRanking.items,
      metadata: {
        source: stableRanking.source,
        newsCount: stableRanking.newsCount,
        matchedCount: stableRanking.matchedCount,
        generatedAt: new Date().toISOString(),
        cacheStatus: "miss",
      },
      warning: warningFor(stableRanking.newsCount, stableRanking.matchedCount),
    };

    cachedPayload = payload;
    cachedAt = Date.now();
    return payload;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
};

export async function GET() {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }
  try {
    const now = Date.now();

    if (cachedPayload && now - cachedAt < CACHE_TTL_MS) {
      return NextResponse.json(withCacheStatus(cachedPayload, "hit"));
    }

    if (cachedPayload && now - cachedAt < STALE_TTL_MS) {
      void refreshTopTradingValue();
      return NextResponse.json(withCacheStatus(cachedPayload, "stale"));
    }

    const payload = await refreshTopTradingValue();
    return NextResponse.json(payload);
  } catch (error: any) {
    console.error(
      "top-trading-value エラー:",
      error?.message || "Unknown error"
    );

    if (cachedPayload) {
      return NextResponse.json({
        ...withCacheStatus(cachedPayload, "stale"),
        warning: "stale_signal",
      });
    }

    return NextResponse.json(
      {
        items: [],
        error: "ranking_fetch_failed",
        warning: "news_unavailable",
      },
      { status: 200 }
    );
  }
}
