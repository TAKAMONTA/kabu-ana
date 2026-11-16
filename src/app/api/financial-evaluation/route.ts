import { NextRequest, NextResponse } from "next/server";
import { OpenRouterClient } from "@/lib/api/openrouter";
import {
  AI_SERVICE_UNAVAILABLE_MESSAGE,
  getOpenRouterApiKey,
} from "@/lib/api/openrouterConfig";
import { createBundledSkip } from "@/lib/utils/aiBundleToken";
import {
  markNotCountable,
  withDailyLimit,
} from "@/lib/utils/dailyUsageLimiter";
import { withRateLimit } from "@/lib/utils/rateLimiter";
import { sanitizeError } from "@/lib/utils/logSanitizer";
import { financialEvaluationSchema } from "@/lib/validation/schemas";
export const dynamic = "force-dynamic";

async function financialEvaluationHandler(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }
  try {
    const body = await request.json().catch(() => null);
    const parsed = financialEvaluationSchema.safeParse(body);
    if (!parsed.success) {
      // zod の詳細（issues）は返さない
      return NextResponse.json(
        { error: "シンボルと企業名が必要です" },
        { status: 400 }
      );
    }
    const { symbol, companyName, financialData, edinetExtras } = parsed.data;

    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
      console.error("financial-evaluation: OpenRouter APIキーが未設定です");
      return NextResponse.json(
        { error: AI_SERVICE_UNAVAILABLE_MESSAGE },
        { status: 503 }
      );
    }

    const client = new OpenRouterClient(apiKey);
    const result = await client.analyzeFinancials(
      companyName,
      symbol,
      financialData || {},
      edinetExtras ?? undefined
    );

    const response = NextResponse.json({ analysis: result });
    // AI応答を読み取れなかった（呼び出し失敗を含む）結果は無料枠を消費させない
    return result.parseFailed ? markNotCountable(response) : response;
  } catch (error: unknown) {
    console.error(`財務評価APIエラー: ${sanitizeError(error)}`);
    return NextResponse.json(
      { error: "財務評価に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(
  withDailyLimit(financialEvaluationHandler, {
    skip: createBundledSkip("financial"),
  })
);
