import { NextRequest, NextResponse } from "next/server";
import {
  AI_ANALYSIS_FAILED_MESSAGE,
  AiServiceError,
  OpenRouterClient,
} from "@/lib/api/openrouter";
import {
  AI_SERVICE_UNAVAILABLE_MESSAGE,
  getOpenRouterApiKey,
} from "@/lib/api/openrouterConfig";
import { sanitizeError } from "@/lib/utils/logSanitizer";
import { formatSSE, splitNarrativeAndJson } from "@/lib/api/analysisStream";
import { analysisSchema } from "@/lib/validation/schemas";
import { withRateLimit } from "@/lib/utils/rateLimiter";
import { withDailyLimit, getClientIP } from "@/lib/utils/dailyUsageLimiter";
import { createAiBundleToken } from "@/lib/utils/aiBundleToken";
export const dynamic = "force-dynamic";

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
      price: toFiniteNumber(
        rawStockData.price,
        toFiniteNumber(companyInfo.price)
      ),
      change: toFiniteNumber(
        rawStockData.change,
        toFiniteNumber(companyInfo.change)
      ),
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
      eps:
        rawStockData.eps == null ? undefined : toFiniteNumber(rawStockData.eps),
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

/** ストリームが終わっても構造化JSONが読めなかったとき（クライアントが待ち続けないように送る） */
const RESULT_UNREADABLE_MESSAGE =
  "AI分析の結果を読み取れませんでした。もう一度お試しください。";

async function analyzeHandler(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }
  const startedAt = Date.now();
  try {
    const body = await request.json().catch(() => null);
    // normalizeAnalysisBody は欠けた値を "UNKNOWN" 等で補うので、本文そのものが
    // 無い・companyInfo が無いリクエストは補う前に弾く（空の本文で AI が呼ばれないように）
    const hasCompanyInfo =
      body !== null &&
      typeof body === "object" &&
      body.companyInfo !== null &&
      typeof body.companyInfo === "object" &&
      (typeof body.companyInfo.symbol === "string" ||
        typeof body.companyInfo.name === "string");
    const validationResult = hasCompanyInfo
      ? analysisSchema.safeParse(normalizeAnalysisBody(body))
      : null;

    if (!validationResult || !validationResult.success) {
      // zod の issues はそのまま返さない
      return NextResponse.json(
        { error: "入力データが無効です" },
        { status: 400 }
      );
    }

    const { companyInfo, stockData, newsData, edinetExtras, question } =
      validationResult.data;

    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
      console.error("analyze: OpenRouter APIキーが未設定です");
      return NextResponse.json(
        { error: AI_SERVICE_UNAVAILABLE_MESSAGE },
        { status: 503 }
      );
    }

    const openRouter = new OpenRouterClient(apiKey);
    const generator = openRouter.analyzeStockStream(
      companyInfo,
      stockData,
      newsData || [],
      edinetExtras ?? undefined,
      question ?? undefined
    );

    // preflight: advance to first chunk before returning 200 so that
    // withDailyLimit only increments on a genuinely successful stream
    let firstChunk: string;
    try {
      const first = await generator.next();
      if (first.done) {
        return NextResponse.json(
          { error: AI_ANALYSIS_FAILED_MESSAGE },
          { status: 502 }
        );
      }
      firstChunk = first.value;
    } catch (preflightError) {
      if (preflightError instanceof AiServiceError) {
        return NextResponse.json(
          { error: preflightError.message },
          { status: preflightError.status }
        );
      }
      console.error(`analyze: 想定外のエラー: ${sanitizeError(preflightError)}`);
      return NextResponse.json(
        { error: AI_ANALYSIS_FAILED_MESSAGE },
        { status: 500 }
      );
    }

    const clientIp = getClientIP(request);
    const bundleTokens = {
      financial: createAiBundleToken(clientIp, companyInfo.symbol, "financial"),
      news: createAiBundleToken(clientIp, companyInfo.symbol, "news"),
    };

    const stream = new ReadableStream({
      async start(controller) {
        const enqueue = (chunk: string) =>
          controller.enqueue(new TextEncoder().encode(chunk));

        enqueue(formatSSE("bundle", JSON.stringify(bundleTokens)));

        let fullText = firstChunk;
        enqueue(formatSSE("narrative", firstChunk));

        try {
          for await (const delta of generator) {
            fullText += delta;
            enqueue(formatSSE("narrative", delta));
          }

          const { json } = splitNarrativeAndJson(fullText);
          if (json) {
            const analysisResult = openRouter.parseAnalysisResult(json);
            enqueue(formatSSE("result", JSON.stringify(analysisResult)));
          } else {
            // result も error も送らないと、クライアントは結果待ちのまま終わる
            console.warn("analyze: ストリーム終了時に構造化JSONがありませんでした", {
              symbol: companyInfo.symbol,
            });
            enqueue(formatSSE("error", RESULT_UNREADABLE_MESSAGE));
          }

          console.info("Analyze API timings", {
            symbol: companyInfo.symbol,
            durationMs: Date.now() - startedAt,
            newsCount: newsData?.length || 0,
          });
        } catch (streamError) {
          if (!(streamError instanceof AiServiceError)) {
            console.error(`analyze: ストリーム中のエラー: ${sanitizeError(streamError)}`);
          }
          enqueue(
            formatSSE(
              "error",
              streamError instanceof AiServiceError
                ? streamError.message
                : AI_ANALYSIS_FAILED_MESSAGE
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const { logError } = await import("@/lib/utils/errorHandler");
    logError(error, "Analysis API");
    return NextResponse.json(
      { error: "分析中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(withDailyLimit(analyzeHandler));
