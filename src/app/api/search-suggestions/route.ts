import { NextRequest, NextResponse } from "next/server";
import { FMPClient } from "@/lib/api/fmp";
import { SerpApiClient } from "@/lib/api/serpapi";
import { withRateLimit } from "@/lib/utils/rateLimiter";

async function searchSuggestionsHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const fmpApiKey = process.env.FMP_API_KEY;
    const serpApiKey = process.env.SERPAPI_API_KEY;

    let suggestions: any[] = [];

    // FMP APIを使用して検索候補を取得（優先）
    if (fmpApiKey && fmpApiKey !== "your_fmp_api_key_here") {
      try {
        const fmpApi = new FMPClient(fmpApiKey);
        const fmpResults = await fmpApi.comprehensiveSearch(query);
        suggestions = fmpResults.slice(0, 5);
      } catch (error) {
        console.error("FMP検索候補エラー:", error);
      }
    }

    // SERPAPIをフォールバックとして使用
    if (
      suggestions.length === 0 &&
      serpApiKey &&
      serpApiKey !== "your_serpapi_key_here"
    ) {
      try {
        const serpApi = new SerpApiClient(serpApiKey);
        const serpResult = await serpApi.searchCompany(query);
        if (serpResult) {
          suggestions = [serpResult];
        }
      } catch (error) {
        console.error("SERPAPI検索候補エラー:", error);
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
    console.error("検索候補エラー:", error);
    return NextResponse.json(
      { error: error.message || "検索候補の取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export { searchSuggestionsHandler as POST };
