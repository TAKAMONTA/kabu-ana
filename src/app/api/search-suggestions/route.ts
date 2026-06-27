import { NextRequest, NextResponse } from "next/server";
import { createMarketDataClient } from "@/lib/api/marketDataClient";
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
      const result = await marketApi.searchCompany(query);
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
