import { NextRequest, NextResponse } from "next/server";
import { FMPClient } from "@/lib/api/fmp";
import { createMarketDataClient } from "@/lib/api/marketDataClient";
import { withRateLimit } from "@/lib/utils/rateLimiter";
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

    const fmpApiKey = process.env.FMP_API_KEY;

    let suggestions: any[] = [];

    // FMP APIを使用して検索候補を取得（優先）
    if (fmpApiKey && fmpApiKey !== "your_fmp_api_key_here") {
      try {
        const fmpApi = new FMPClient(fmpApiKey);
        const fmpResults = await fmpApi.comprehensiveSearch(query);
        suggestions = fmpResults.slice(0, 5);
      } catch (error) {
        console.error(
          "FMP検索候補エラー:",
          error instanceof Error ? error.message : error
        );
      }
    }

    // 市場データクライアント（既定 Yahoo）をフォールバックとして使用
    if (suggestions.length === 0) {
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
