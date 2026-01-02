import { NextRequest, NextResponse } from "next/server";
import { OpenRouterClient } from "@/lib/api/openrouter";
import { analysisSchema } from "@/lib/validation/schemas";
import { withRateLimit } from "@/lib/utils/rateLimiter";

async function analyzeHandler(request: NextRequest) {
  try {
    // 入力データの検証
    const body = await request.json();
    const validationResult = analysisSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "入力データが無効です",
          details: validationResult.error.errors.map(err => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    const { companyInfo, stockData, newsData } = validationResult.data;

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
    // セキュアなエラーハンドリング
    const { createErrorResponse, logError } = await import(
      "@/lib/utils/errorHandler"
    );
    logError(error, "Analysis API");
    return createErrorResponse(error, "分析中にエラーが発生しました");
  }
}

export const POST = withRateLimit(analyzeHandler);
