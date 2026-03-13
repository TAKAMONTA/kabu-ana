import { NextRequest, NextResponse } from "next/server";
import { OpenRouterClient } from "@/lib/api/openrouter";
import { withDailyLimit } from "@/lib/utils/dailyUsageLimiter";
export const dynamic = process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

async function financialEvaluationHandler(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }
  try {
    const { symbol, companyName, financialData } = await request.json();
    if (!symbol || !companyName) {
      return NextResponse.json(
        { error: "シンボルと企業名が必要です" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === "your_openrouter_api_key_here") {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEYが設定されていません" },
        { status: 400 }
      );
    }

    const client = new OpenRouterClient(apiKey);
    const result = await client.analyzeFinancials(
      companyName,
      symbol,
      financialData || {}
    );

    return NextResponse.json({ analysis: result });
  } catch (error: any) {
    console.error("財務評価APIエラー:", error);
    return NextResponse.json(
      { error: error.message || "財務評価に失敗しました" },
      { status: 500 }
    );
  }
}

export const POST = withDailyLimit(financialEvaluationHandler);
