import { NextRequest, NextResponse } from "next/server";
import { createMarketDataClient } from "@/lib/api/marketDataClient";
import { resolveSearchQuery } from "@/lib/jpx/searchResolution";
export const dynamic =
  process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

async function searchSuggestionsHandler(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    let suggestions: any[] = [];

    // 市場データクライアントで検索候補を取得
    try {
      const marketApi = createMarketDataClient();
      // 優先順位規則（4桁コード直指定 → 個別株言及とETFの一致長比較）は /api/search と共通化。
      const { effectiveQuery } = resolveSearchQuery(query);
      const result = await marketApi.searchCompany(effectiveQuery);
      if (result) {
        suggestions = [result];
      }
    } catch (error) {
      console.error(
        "市場データ検索候補エラー:",
        error instanceof Error ? error.message : error
      );
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
  } catch (error: any) {
    console.error("検索候補エラー:", error.message || "Unknown error");
    return NextResponse.json(
      { error: error.message || "検索候補の取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export { searchSuggestionsHandler as POST };
