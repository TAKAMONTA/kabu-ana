import { NextResponse } from "next/server";
import { FreeNewsClient } from "@/lib/api/freeNews";
import {
  buildStableTopTradingItems,
  normalizeMarketNewsIdentity,
  type TradingValueItem,
} from "@/lib/topTradingValue";

// export const dynamic = "force-dynamic";
export const revalidate = 60 * 30; // 30分ごとに更新

export const dynamic = process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

const NEWS_TOPICS = [
  "日本株 急騰 銘柄",
  "日本株 ストップ高 材料",
  "東証 決算 上方修正",
  "日本株 個別銘柄 材料",
  "東京市場 値上がり 個別銘柄",
  "株式 注目株 材料",
];
const NEWS_LIMIT_PER_TOPIC = 8;
const NEWS_FETCH_TIMEOUT_MS = 4000;
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

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("news_fetch_timeout")), timeoutMs);
    }),
  ]);

const fetchMarketNews = async () => {
  const newsClient = new FreeNewsClient();
  const results = await Promise.allSettled(
    NEWS_TOPICS.map(topic =>
      withTimeout(
        newsClient.getNewsFromGoogleRSS(topic, NEWS_LIMIT_PER_TOPIC),
        NEWS_FETCH_TIMEOUT_MS
      )
    )
  );

  const allNews = results.flatMap((result, index) => {
    if (result.status === "fulfilled") return result.value;
    console.warn(`⚠️ トピック「${NEWS_TOPICS[index]}」のニュース取得失敗:`, result.reason);
    return [];
  });
  
  // Google Newsや転載記事の表記揺れを寄せて重複を除去
  const uniqueNews = Array.from(
    new Map(allNews.map(item => [normalizeMarketNewsIdentity(item), item])).values()
  );
  
  return uniqueNews.slice(0, 40);
};

const warningFor = (newsCount: number, matchedCount: number): string | undefined => {
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
    console.error("top-trading-value エラー:", error?.message || "Unknown error");

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
