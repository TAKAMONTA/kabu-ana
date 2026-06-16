import { NextRequest, NextResponse } from "next/server";
import { OpenRouterClient } from "@/lib/api/openrouter";
import { formatSSE, splitNarrativeAndJson } from "@/lib/api/analysisStream";
import { analysisSchema } from "@/lib/validation/schemas";
import { withRateLimit } from "@/lib/utils/rateLimiter";
import { withDailyLimit } from "@/lib/utils/dailyUsageLimiter";
export const dynamic =
  process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

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

async function analyzeHandler(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }
  const startedAt = Date.now();
  try {
    const body = await request.json();
    const validationResult = analysisSchema.safeParse(
      normalizeAnalysisBody(body)
    );

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

    const { companyInfo, stockData, newsData, edinetExtras } =
      validationResult.data;

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
    const generator = openRouter.analyzeStockStream(
      companyInfo,
      stockData,
      newsData || [],
      edinetExtras ?? undefined
    );

    // preflight: advance to first chunk before returning 200 so that
    // withDailyLimit only increments on a genuinely successful stream
    let firstChunk: string;
    try {
      const first = await generator.next();
      if (first.done) {
        return NextResponse.json(
          { error: "AI分析中にエラーが発生しました。" },
          { status: 500 }
        );
      }
      firstChunk = first.value;
    } catch (preflightError) {
      const message =
        preflightError instanceof Error
          ? preflightError.message
          : "AI分析中にエラーが発生しました。";
      const status = message.includes("認証")
        ? 401
        : message.includes("残高")
          ? 402
          : message.includes("制限")
            ? 429
            : 500;
      return NextResponse.json({ error: message }, { status });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const enqueue = (chunk: string) =>
          controller.enqueue(new TextEncoder().encode(chunk));

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
          }

          console.info("Analyze API timings", {
            symbol: companyInfo.symbol,
            durationMs: Date.now() - startedAt,
            newsCount: newsData?.length || 0,
          });
        } catch (streamError) {
          const message =
            streamError instanceof Error
              ? streamError.message
              : "AI分析中にエラーが発生しました。";
          enqueue(formatSSE("error", message));
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
    const message =
      error instanceof Error ? error.message : "分析中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withRateLimit(withDailyLimit(analyzeHandler));
