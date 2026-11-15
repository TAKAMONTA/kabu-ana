import { NextRequest, NextResponse } from "next/server";
import { createMarketDataClient } from "@/lib/api/marketDataClient";
import { resolveSearchQuery } from "@/lib/jpx/searchResolution";
import {
  searchSchema,
  searchSuggestionsSchema,
} from "@/lib/validation/schemas";
import { withRateLimit } from "@/lib/utils/rateLimiter";
import { optionalWithTimeout } from "@/lib/utils/optionalTimeout";
import { sanitizeError } from "@/lib/utils/logSanitizer";
export const dynamic = "force-dynamic";

/** 候補の外部API呼び出しのタイムアウト（入力途中に呼ばれるので短め） */
const SUGGESTION_TIMEOUT_MS = 3000;

async function searchSuggestionsHandler(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }
  try {
    const body = await request.json().catch(() => null);
    const parsed = searchSuggestionsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "検索キーワードの形式が正しくありません" },
        { status: 400 }
      );
    }

    const query = parsed.data.query.trim();
    // 入力途中の短い文字列・/api/search が受け付けない文字は、エラーではなく候補なし
    if (query.length < 2 || !searchSchema.shape.query.safeParse(query).success) {
      return NextResponse.json({ suggestions: [] });
    }

    let suggestions: Array<Record<string, unknown>> = [];

    // 市場データクライアントで検索候補を取得
    try {
      const marketApi = createMarketDataClient();
      // 優先順位規則（4桁コード直指定 → 個別株言及とETFの一致長比較）は /api/search と共通化。
      const { effectiveQuery } = resolveSearchQuery(query);
      const result = await optionalWithTimeout(
        marketApi.searchCompany(effectiveQuery),
        SUGGESTION_TIMEOUT_MS,
        "market.searchCompany.suggestions"
      );
      if (result) {
        suggestions = [result as unknown as Record<string, unknown>];
      }
    } catch (error) {
      console.error(`市場データ検索候補エラー: ${sanitizeError(error)}`);
    }

    // 検索候補を整形
    const formattedSuggestions = suggestions.map(item => ({
      symbol: item.symbol,
      companyName: item.companyName || item.name,
      exchange: item.exchange,
      score: item.score,
      searchType: item.searchType,
    }));

    return NextResponse.json({ suggestions: formattedSuggestions });
  } catch (error: unknown) {
    console.error(`検索候補エラー: ${sanitizeError(error)}`);
    return NextResponse.json(
      { error: "検索候補の取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(searchSuggestionsHandler);
