import { NextRequest, NextResponse } from "next/server";
import { OpenRouterClient } from "@/lib/api/openrouter";
import { analysisSchema } from "@/lib/validation/schemas";
import { withRateLimit } from "@/lib/utils/rateLimiter";
import { withDailyLimit } from "@/lib/utils/dailyUsageLimiter";
export const dynamic = process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

function toFiniteNumber(value: unknown, fallback = 0): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeAnalysisBody(body: any) {
  const companyInfo = body?.companyInfo || {};
  const rawStockData = body?.stockData || {};

  return {
    ...body,
    companyInfo: {
      ...companyInfo,
      name: String(companyInfo.name || companyInfo.symbol || "Unknown"),
      symbol: String(companyInfo.symbol || rawStockData.symbol || "UNKNOWN"),
      market: String(companyInfo.market || ""),
      price:
        companyInfo.price == null
          ? undefined
          : toFiniteNumber(companyInfo.price),
      change:
        companyInfo.change == null
          ? undefined
          : toFiniteNumber(companyInfo.change),
      changePercent:
        companyInfo.changePercent == null
          ? undefined
          : toFiniteNumber(companyInfo.changePercent),
    },
    stockData: {
      ...rawStockData,
      symbol: String(rawStockData.symbol || companyInfo.symbol || "UNKNOWN"),
      price: toFiniteNumber(rawStockData.price, toFiniteNumber(companyInfo.price)),
      change: toFiniteNumber(rawStockData.change, toFiniteNumber(companyInfo.change)),
      changePercent: toFiniteNumber(
        rawStockData.changePercent,
        toFiniteNumber(companyInfo.changePercent)
      ),
      volume: toFiniteNumber(rawStockData.volume),
      marketCap:
        rawStockData.marketCap == null || rawStockData.marketCap === ""
          ? "N/A"
          : String(rawStockData.marketCap),
      pe: rawStockData.pe == null ? undefined : toFiniteNumber(rawStockData.pe),
      eps: rawStockData.eps == null ? undefined : toFiniteNumber(rawStockData.eps),
      dividend:
        rawStockData.dividend == null
          ? undefined
          : toFiniteNumber(rawStockData.dividend),
      high52:
        rawStockData.high52 == null
          ? undefined
          : toFiniteNumber(rawStockData.high52),
      low52:
        rawStockData.low52 == null
          ? undefined
          : toFiniteNumber(rawStockData.low52),
    },
    newsData: Array.isArray(body?.newsData) ? body.newsData : [],
  };
}

async function analyzeHandler(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }
  const startedAt = Date.now();
  try {
    // 入力データの検証
    const body = await request.json();
    const validationResult = analysisSchema.safeParse(normalizeAnalysisBody(body));

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

    console.info("Analyze API timings", {
      symbol: companyInfo.symbol,
      durationMs: Date.now() - startedAt,
      newsCount: newsData?.length || 0,
    });

    return NextResponse.json({
      analysis: analysisResult,
      timestamp: new Date().toISOString(),
      metadata: {
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    const { logError } = await import("@/lib/utils/errorHandler");
    logError(error, "Analysis API");
    const message = error instanceof Error ? error.message : "分析中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withRateLimit(withDailyLimit(analyzeHandler));
