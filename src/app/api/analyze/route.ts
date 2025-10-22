import { NextRequest, NextResponse } from "next/server";
import { OpenRouterClient } from "@/lib/api/openrouter";

export async function POST(request: NextRequest) {
  try {
    const { companyInfo, stockData, newsData } = await request.json();

    if (!companyInfo || !stockData) {
      return NextResponse.json(
        { error: "企業情報と株価データが必要です" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === "your_openrouter_key_here") {
      return NextResponse.json(
        {
          error:
            "OpenRouter APIキーが設定されていません。.env.localファイルでOPENROUTER_API_KEYを設定してください。",
        },
        { status: 400 }
      );
    }

    const openRouter = new OpenRouterClient(apiKey);

    // AI分析を実行
    const analysisResult = await openRouter.analyzeStock(
      companyInfo,
      stockData,
      newsData || []
    );

    return NextResponse.json({
      analysis: analysisResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("分析エラー:", error);
    return NextResponse.json(
      { error: "分析中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
