import { NextRequest, NextResponse } from "next/server";
import { logger, logApiError } from "@/app/lib/logger";
import { validateStockCode } from "@/app/lib/validation";
import {
  assessDataQuality,
  generateDataQualityReport,
} from "@/app/lib/data-quality";

// 価格表示用の型（必要なキーだけ持たせるためオプショナル）
type PriceInfo = {
  current?: string;
  range?: string;
};

interface AIResponse {
  analysis: string;
  recommendation: Decision;
  confidence: number;
  structured?: StructuredAnalysis;
}

type Decision = "買い" | "売り" | "保留";

interface FinancialMetrics {
  PER?: number | null;
  PBR?: number | null;
  ROE?: number | null;
  配当利回り?: number | null;
}

interface TechnicalMetrics {
  MA25?: number | null;
  MA75?: number | null;
  MA200?: number | null;
  RSI?: number | null;
  MACD?: {
    値?: number | null;
    シグナル?: number | null;
    ヒストグラム?: number | null;
  } | null;
}

interface StructuredAnalysis {
  summary?: string;
  price?: PriceInfo;
  financialMetrics?: FinancialMetrics;
  technicalMetrics?: TechnicalMetrics;
  trend?: string;
  fundamentals?: string;
  rationale?: string;
  risks?: string;
  targetRange?: string;
  horizon?: string;
}

export async function POST(request: NextRequest) {
  try {
    let { stockCode } = await request.json();

    // 入力検証
    const validation = validateStockCode(stockCode);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 正規化されたコードを使用
    stockCode = validation.normalizedCode || stockCode;

    logger.info({ stockCode }, "データ収集開始");

    // Phase 1: データ収集
    const collectResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/collect-data`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockCode }),
      }
    );

    if (!collectResponse.ok) {
      const errorData = await collectResponse.json();
      throw new Error(
        `データ収集に失敗: ${errorData.error || errorData.details}`
      );
    }

    const collectResult = await collectResponse.json();
    const unifiedData = collectResult.data;

    // データ品質チェック
    const dataQuality = assessDataQuality(unifiedData);
    const qualityReport = generateDataQualityReport(dataQuality);

    logger.info(
      {
        stockCode,
        hasData: !!unifiedData,
        hasStockPrice: !!unifiedData?.株価情報,
        currentPrice: unifiedData?.株価情報?.現在値,
        dataQualityScore: dataQuality.score,
        isAdequate: dataQuality.isAdequate,
        unifiedData: JSON.stringify(unifiedData),
      },
      "データ収集完了、品質チェック実施"
    );

    // データ品質が不十分な場合は警告を返す（ただし分析は継続）
    if (!dataQuality.isAdequate) {
      logger.warn(
        {
          stockCode,
          score: dataQuality.score,
          missingFields: dataQuality.missingFields,
        },
        "データ品質が不十分ですが、分析を継続します"
      );
    }

    // Phase 2: 並列AI分析
    const [geminiResponse, claudeResponse, openaiResponse] = await Promise.all([
      fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/analyze-gemini`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unifiedData }),
        }
      ),
      fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/analyze-claude`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unifiedData }),
        }
      ),
      fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/analyze-openai`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unifiedData }),
        }
      ),
    ]);

    // エラーチェック
    const responses = [
      { name: "Gemini", response: geminiResponse },
      { name: "Claude", response: claudeResponse },
      { name: "OpenAI", response: openaiResponse },
    ];

    for (const { name, response } of responses) {
      if (!response.ok) {
        const errorData = await response.json();
        logger.error({ ai: name, error: errorData }, `${name}分析エラー`);
        throw new Error(`${name}分析に失敗: ${errorData.error}`);
      }
    }

    const geminiData = await geminiResponse.json();
    const claudeData = await claudeResponse.json();
    const openaiData = await openaiResponse.json();

    logger.info({ stockCode }, "AI分析完了、結果統合開始");

    // AI分析結果を変換
    const geminiResult = convertToAIResponse(geminiData.result);
    const claudeResult = convertToAIResponse(claudeData.result);
    const openaiResult = convertToAIResponse(openaiData.result);

    // 最終判断を生成
    const finalJudgement = generateFinalJudgement(
      openaiResult,
      claudeResult,
      geminiResult
    );

    logger.info({ stockCode, decision: finalJudgement.decision }, "分析完了");

    return NextResponse.json({
      stockCode,
      timestamp: new Date().toISOString(),
      openai: openaiResult,
      claude: claudeResult,
      gemini: geminiResult,
      finalJudgement,
      dataQuality: {
        score: dataQuality.score,
        isAdequate: dataQuality.isAdequate,
        report: qualityReport,
        details: dataQuality.details,
      },
    });
  } catch (error) {
    logApiError("POST", "/api/orchestrator", error);
    return NextResponse.json(
      { error: "分析中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// 分析テキストから数値を抽出するヘルパー関数
function extractNumberFromText(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match) return null;
  const value = parseFloat(match[1].replace(/,/g, ""));
  return isNaN(value) ? null : value;
}

// AI分析結果を共通のAIResponse形式に変換
function convertToAIResponse(result: {
  AI名: string;
  専門分野: string;
  推奨の見立て: Decision;
  信頼度: number;
  分析内容: Record<string, unknown>;
  リスク要因?: string[];
  目標株価?: {
    下限: number | null;
    上限: number | null;
  };
  投資期間?: string;
}): AIResponse {
  // 分析内容から主要な情報を抽出
  const analysisContent = result.分析内容;
  const stockInfo = analysisContent.株価情報 as
    | { 現在値: number; 前日比?: string; 注: string }
    | undefined;

  // 分析テキストを生成
  let analysisText = `【${result.専門分野}】\n`;

  // 各分析項目を整形（株価情報は別途処理）
  for (const [key, value] of Object.entries(analysisContent)) {
    if (key === "株価情報") continue;
    if (typeof value === "string" && value.trim()) {
      analysisText += `${key}\n${value}\n\n`;
    }
  }

  // リスク要因を追加
  if (result.リスク要因 && result.リスク要因.length > 0) {
    analysisText += `リスク要因\n${result.リスク要因.map(r => `・${r}`).join("\n")}`;
  }

  // 財務指標を抽出（オブジェクトまたはテキストから）
  const financialMetricsObj = analysisContent.財務指標サマリー as
    | FinancialMetrics
    | undefined;

  // テキストから財務指標を抽出
  const extractedFinancials = {
    PER: extractNumberFromText(analysisText, /PER[:\s]+([0-9.]+)/i),
    PBR: extractNumberFromText(analysisText, /PBR[:\s]+([0-9.]+)/i),
    ROE: extractNumberFromText(analysisText, /ROE[:\s]+([0-9.]+)/i),
    配当利回り: extractNumberFromText(
      analysisText,
      /配当利回り[:\s]+([0-9.]+)/i
    ),
  };

  const financialMetrics =
    financialMetricsObj ||
    (Object.values(extractedFinancials).some(v => v !== null)
      ? extractedFinancials
      : undefined);

  // テクニカル指標を抽出（オブジェクトまたはテキストから）
  const technicalMetricsObj = analysisContent.テクニカル指標サマリー as
    | TechnicalMetrics
    | undefined;

  // テキストからテクニカル指標を抽出
  const extractedTechnicals = {
    MA25: extractNumberFromText(analysisText, /MA25[:\s]+([0-9,]+)/i),
    MA75: extractNumberFromText(analysisText, /MA75[:\s]+([0-9,]+)/i),
    MA200: extractNumberFromText(analysisText, /MA200[:\s]+([0-9,]+)/i),
    RSI: extractNumberFromText(analysisText, /RSI[:\s]+([0-9.]+)/i),
  };

  const technicalMetrics =
    technicalMetricsObj ||
    (Object.values(extractedTechnicals).some(v => v !== null)
      ? extractedTechnicals
      : undefined);

  // 株価情報を抽出（オブジェクトまたはテキストから）
  let priceInfo = stockInfo
    ? {
        current: stockInfo.前日比
          ? `${stockInfo.現在値}円 (${stockInfo.前日比})`
          : `${stockInfo.現在値}円`,
        range:
          result.目標株価 && result.目標株価.下限 && result.目標株価.上限
            ? `${result.目標株価.下限}円〜${result.目標株価.上限}円`
            : undefined,
      }
    : undefined;

  // テキストから株価情報を抽出
  if (!priceInfo) {
    const currentPrice =
      extractNumberFromText(analysisText, /現在値[:\s]+([0-9,]+)/i) ||
      extractNumberFromText(analysisText, /株価[:\s]+([0-9,]+)/i);
    const targetPriceLower =
      extractNumberFromText(analysisText, /目標株価[:\s]+([0-9,]+)/i) ||
      extractNumberFromText(analysisText, /¥([0-9,]+)\s*〜/i);
    const targetPriceUpper = extractNumberFromText(
      analysisText,
      /〜\s*¥([0-9,]+)/i
    );

    // 値の存在を null/undefined で判定（0 を正しく許容）
    const hasCurrent = currentPrice != null;
    const hasTL = targetPriceLower != null;
    const hasTU = targetPriceUpper != null;
    const hasResultRange =
      result?.目標株価?.下限 != null && result?.目標株価?.上限 != null;

    if (hasCurrent || hasTL || hasTU || hasResultRange) {
      const price: PriceInfo = {};

      if (hasCurrent) {
        // number 以外の可能性があるなら Number() で保険
        const cur =
          typeof currentPrice === "number"
            ? currentPrice
            : Number(currentPrice);
        if (Number.isFinite(cur)) price.current = `${cur.toLocaleString()}円`;
      }

      if (hasResultRange) {
        const lo =
          typeof result.目標株価!.下限 === "number"
            ? result.目標株価!.下限
            : Number(result.目標株価!.下限);
        const hi =
          typeof result.目標株価!.上限 === "number"
            ? result.目標株価!.上限
            : Number(result.目標株価!.上限);
        if (Number.isFinite(lo) && Number.isFinite(hi)) {
          price.range = `${lo.toLocaleString()}円〜${hi.toLocaleString()}円`;
        }
      } else if (hasTL && hasTU) {
        const lo =
          typeof targetPriceLower === "number"
            ? targetPriceLower
            : Number(targetPriceLower);
        const hi =
          typeof targetPriceUpper === "number"
            ? targetPriceUpper
            : Number(targetPriceUpper);
        if (Number.isFinite(lo) && Number.isFinite(hi)) {
          price.range = `${lo.toLocaleString()}円〜${hi.toLocaleString()}円`;
        }
      }

      // 値が一切入らなかった場合は代入しない（型安全）
      if (Object.keys(price).length > 0) {
        priceInfo = price;
      }
    }
  }

  // 構造化データを作成
  const structured: StructuredAnalysis = {
    summary: analysisText.substring(0, 200),
    price: priceInfo,
    financialMetrics: financialMetrics
      ? {
          PER: financialMetrics.PER ?? null,
          PBR: financialMetrics.PBR ?? null,
          ROE: financialMetrics.ROE ?? null,
          配当利回り: financialMetrics.配当利回り ?? null,
        }
      : undefined,
    technicalMetrics: technicalMetrics
      ? {
          MA25: technicalMetrics.MA25 ?? null,
          MA75: technicalMetrics.MA75 ?? null,
          MA200: technicalMetrics.MA200 ?? null,
          RSI: technicalMetrics.RSI ?? null,
          MACD: technicalMetrics.MACD ?? null,
        }
      : undefined,
    trend:
      typeof analysisContent.トレンド分析 === "string"
        ? analysisContent.トレンド分析
        : typeof analysisContent.テクニカル総合 === "string"
          ? analysisContent.テクニカル総合
          : typeof analysisContent.移動平均線 === "string"
            ? analysisContent.移動平均線
            : undefined,
    fundamentals:
      typeof analysisContent.ファンダメンタル総合 === "string"
        ? analysisContent.ファンダメンタル総合
        : typeof analysisContent.財務健全性 === "string"
          ? analysisContent.財務健全性
          : typeof analysisContent.収益性評価 === "string"
            ? analysisContent.収益性評価
            : undefined,
    rationale:
      typeof analysisContent.投資判断理由 === "string"
        ? analysisContent.投資判断理由
        : typeof analysisContent.投資価値 === "string"
          ? analysisContent.投資価値
          : typeof analysisContent.推奨理由 === "string"
            ? analysisContent.推奨理由
            : undefined,
    risks:
      result.リスク要因 && result.リスク要因.length > 0
        ? result.リスク要因.join("、")
        : undefined,
    targetRange:
      result.目標株価 && result.目標株価.下限 && result.目標株価.上限
        ? `${result.目標株価.下限}円〜${result.目標株価.上限}円`
        : result.目標株価 && (result.目標株価.下限 || result.目標株価.上限)
          ? result.目標株価.下限
            ? `${result.目標株価.下限}円以上`
            : `${result.目標株価.上限}円以下`
          : undefined,
    horizon: result.投資期間,
  };

  return {
    analysis: analysisText,
    recommendation: result.推奨の見立て,
    confidence: result.信頼度 / 100, // 0-100を0-1に変換
    structured,
  };
}

function generateFinalJudgement(
  openai: AIResponse,
  claude: AIResponse,
  gemini: AIResponse
): {
  decision: "買い" | "売り" | "保留";
  reasoning: string;
  confidence: number;
} {
  const recommendations = [
    openai.recommendation,
    claude.recommendation,
    gemini.recommendation,
  ];

  const buyCount = recommendations.filter(r => r === "買い").length;
  const sellCount = recommendations.filter(r => r === "売り").length;

  let decision: "買い" | "売り" | "保留";
  let reasoning: string;
  let confidence: number;

  if (buyCount >= 2) {
    decision = "買い";
    reasoning = `3つのAIのうち${buyCount}つが買いを推奨しています。`;
    confidence =
      (openai.confidence + claude.confidence + gemini.confidence) / 3;
  } else if (sellCount >= 2) {
    decision = "売り";
    reasoning = `3つのAIのうち${sellCount}つが売りを推奨しています。`;
    confidence =
      (openai.confidence + claude.confidence + gemini.confidence) / 3;
  } else {
    decision = "保留";
    reasoning = "AI間で意見が分かれています。慎重な判断が必要です。";
    confidence = 0.5;
  }

  return { decision, reasoning, confidence };
}
