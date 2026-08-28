import { NextRequest, NextResponse } from "next/server";
import { isAuthError, verifyAuth } from "@/lib/auth/verifyAuth";
import { createMarketDataClient } from "@/lib/api/marketDataClient";
import { optionalWithTimeout } from "@/lib/utils/optionalTimeout";
import { parseCodesParam } from "@/lib/watchlist/codes";
import { QuotesCache, type WatchlistQuote } from "@/lib/watchlist/quotesCache";

export const dynamic =
  process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

/** 1リクエストで取得できるコード数の上限 */
const MAX_CODES = 20;

/** 1銘柄あたりの取得タイムアウト。遅い外部APIに一覧全体を巻き込ませない */
const QUOTE_TIMEOUT_MS = 8000;

/** プロセス内キャッシュ。J-Quants は1営業日1回しか更新されない */
const cache = new QuotesCache();

export async function GET(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ quotes: {} });
  }

  const authResult = await verifyAuth(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const codes = parseCodesParam(
    request.nextUrl.searchParams.get("codes"),
    MAX_CODES
  );
  if (codes.length === 0) {
    return NextResponse.json({ quotes: {} });
  }

  const marketApi = createMarketDataClient();
  const now = Date.now();

  const entries = await Promise.all(
    codes.map(async (code): Promise<[string, WatchlistQuote | null]> => {
      const cached = cache.get(code, now);
      if (cached) return [code, cached];

      try {
        // optionalWithTimeout は時間切れ・例外のどちらでも null を返す（投げない）
        const data = await optionalWithTimeout(
          marketApi.getStockData(code),
          QUOTE_TIMEOUT_MS,
          `watchlist quote ${code}`
        );
        if (!data || typeof data.price !== "number") return [code, null];
        const quote: WatchlistQuote = {
          close: data.price,
          changePercent: data.changePercent,
          asOf: data.asOf,
        };
        cache.set(code, quote, now);
        return [code, quote];
      } catch (error) {
        console.warn(
          `watchlist/quotes: ${code} の取得に失敗しました`,
          error instanceof Error ? error.message : error
        );
        return [code, null];
      }
    })
  );

  return NextResponse.json({ quotes: Object.fromEntries(entries) });
}
