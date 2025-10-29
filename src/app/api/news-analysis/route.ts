import { NextRequest, NextResponse } from "next/server";
import { OpenRouterClient } from "@/lib/api/openrouter";
import { SerpApiClient } from "@/lib/api/serpapi";
import { FreeNewsClient } from "@/lib/api/freeNews";

export interface NewsAnalysisResult {
  impact: "positive" | "negative" | "neutral";
  impactScore: number; // -100 to 100
  analysis: string;
  keyPoints: string[];
  recommendations: string[];
}

async function newsAnalysisHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, companyName } = body;

    if (!symbol || !companyName) {
      return NextResponse.json(
        { error: "シンボルと企業名が必要です" },
        { status: 400 }
      );
    }

    const serpApiKey = process.env.SERPAPI_API_KEY;
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;

    if (
      !openRouterApiKey ||
      openRouterApiKey === "your_openrouter_api_key_here"
    ) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEYが設定されていません" },
        { status: 400 }
      );
    }

    const openRouterClient = new OpenRouterClient(openRouterApiKey);

    // 最新のニュースを取得（無料の代替手段を使用）
    let newsData: any[] = [];

    // 1. 無料ニュースAPIを試行
    const freeNewsClient = new FreeNewsClient();
    newsData = await freeNewsClient.getComprehensiveNews(
      companyName,
      symbol,
      10
    );

    // 2. SERPAPIをフォールバックとして使用
    if (
      (!newsData || newsData.length === 0) &&
      serpApiKey &&
      serpApiKey !== "your_serpapi_key_here"
    ) {
      const serpApi = new SerpApiClient(serpApiKey);
      const serpNews = await serpApi.getCompanyNews(symbol, 10);
      if (serpNews && serpNews.length > 0) {
        newsData = serpNews;
      } else {
        // Google検索からもニュースを取得
        const googleNews = await serpApi.getCompanyNewsFromGoogle(
          symbol,
          companyName,
          10
        );
        if (googleNews && googleNews.length > 0) {
          newsData = googleNews;
        }
      }
    }

    if (!newsData || newsData.length === 0) {
      return NextResponse.json(
        { error: "ニュースが見つかりませんでした" },
        { status: 404 }
      );
    }

    // AIによるニュース分析
    const analysisResult = await openRouterClient.analyzeNewsImpact(
      companyName,
      symbol,
      newsData
    );

    return NextResponse.json({
      newsData,
      analysis: analysisResult,
    });
  } catch (error: any) {
    console.error("ニュース分析エラー:", error);
    return NextResponse.json(
      { error: error.message || "ニュース分析中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export { newsAnalysisHandler as POST };
