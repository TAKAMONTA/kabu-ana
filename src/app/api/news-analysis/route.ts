import { NextRequest, NextResponse } from "next/server";
import { OpenRouterClient } from "@/lib/api/openrouter";
import { createMarketDataClient } from "@/lib/api/marketDataClient";
import { FreeNewsClient } from "@/lib/api/freeNews";
import {
  isBundledAiSearchRequest,
  withDailyLimit,
} from "@/lib/utils/dailyUsageLimiter";

export interface NewsAnalysisResult {
  impact: "positive" | "negative" | "neutral";
  impactScore: number; // -100 to 100
  analysis: string;
  keyPoints: string[];
  recommendations: string[];
}
export const dynamic =
  process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

async function newsAnalysisHandler(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }
  try {
    const body = await request.json();
    const { symbol, companyName } = body;

    if (!symbol || !companyName) {
      return NextResponse.json(
        { error: "シンボルと企業名が必要です" },
        { status: 400 }
      );
    }

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

    // 2. 市場データクライアント（既定 Yahoo）をフォールバックとして使用
    if (!newsData || newsData.length === 0) {
      const marketApi = createMarketDataClient();
      const marketNews = await marketApi.getCompanyNews(symbol, 10);
      if (marketNews && marketNews.length > 0) {
        newsData = marketNews;
      } else {
        const altNews = await marketApi.getCompanyNewsFromGoogle(
          symbol,
          companyName,
          10
        );
        if (altNews && altNews.length > 0) {
          newsData = altNews;
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
    console.error("ニュース分析エラー:", error.message || "Unknown error");
    return NextResponse.json(
      { error: error.message || "ニュース分析中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const POST = withDailyLimit(newsAnalysisHandler, {
  skip: isBundledAiSearchRequest,
});
