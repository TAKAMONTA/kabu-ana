import { NextRequest, NextResponse } from "next/server";
import openai from "@/app/lib/openai";
import { validateRequestBody, validateStockCode, rateLimitHeaders } from "@/app/lib/validation";
import { validateEnvironmentKeys } from "@/app/lib/apiValidation";
import { checkRateLimit } from "@/app/lib/rateLimiter";
import type { APIResponse } from "@/app/types";

// OpenAIを使用した株価分析
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const validation = validateRequestBody(body, ['stockCode', 'companyInfo']);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(', ') },
        { status: 400 }
      );
    }

    const { stockCode, companyInfo, priceInfo } = body;

    if (!validateStockCode(stockCode)) {
      return NextResponse.json(
        { success: false, error: "Invalid stock code format" },
        { status: 400 }
      );
    }

    const clientIP = request.ip || "unknown";
    const rateLimit = checkRateLimit(clientIP);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Please try again later." },
        { 
          status: 429,
          headers: rateLimitHeaders(rateLimit.remaining, rateLimit.resetIn)
        }
      );
    }

    const envValidation = validateEnvironmentKeys();
    if (!envValidation.valid) {
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    console.log("Analyzing stock with OpenAI:", stockCode);

    // OpenAI APIで包括的分析
    const analysisPrompt = `
以下の情報を基に、${stockCode}の包括的な投資判断の分析を行ってください。

会社情報:
${companyInfo}

現在の株価情報:
${JSON.stringify(priceInfo, null, 2)}

分析項目:
以下のJSON形式で分析結果を回答してください。

{
  "summary": "総合的な投資判断の要約（100文字以内）",
  "investmentScore": 75,  // 投資スコア（-100〜100）
  "recommendation": "BUY/HOLD/SELL",
  "analysis": {
    "strengths": ["強み1", "強み2", "強み3"],
    "weaknesses": ["弱み1", "弱み2"],
    "opportunities": ["機会1", "機会2"],
    "threats": ["脅威1", "脅威2"]
  },
  "technicalAnalysis": {
    "trend": "上昇トレンド/下降トレンド/横ばいトレンド",
    "support": "サポートライン価格",
    "resistance": "レジスタンスライン価格",
    "momentum": "強い/弱い"
  },
  "fundamentalAnalysis": {
    "valuation": "適正/割安/割高",
    "growthPotential": "高い/中程度/低い",
    "profitability": "高収益/中程度/低収益",
    "financialHealth": "健全/中程度/不安定"
  },
  "risks": [
    {
      "type": "市場リスク",
      "level": "高/中/低",
      "description": "説明"
    }
  ],
  "targetPrice": {
    "sixMonths": "6ヶ月後の目標株価",
    "oneYear": "1年後の目標株価",
    "upside": "上昇余地の説明"
  },
  "keyMetrics": {
    "per": "PER数値",
    "pbr": "PBR数値",
    "roe": "ROE数値",
    "dividendYield": "配当利回り"
  },
  "recentNews": [
    "ニュース1",
    "ニュース2"
  ],
  "analystNote": "アナリストの見解や注意点"
}

重要な点:
- JSON形式で回答してください
- 数値は適切な範囲で設定してください
- 分析は客観的で実用的な内容にしてください
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "あなたは株価分析の専門家です。客観的で実用的な分析を提供し、JSON形式で回答してください。",
        },
        {
          role: "user",
          content: analysisPrompt,
        },
      ],
      temperature: 0.3, // より安定した分析のため低めに設定
      response_format: { type: "json_object" },
      max_tokens: 4000, // 包括的な分析のため十分なトークン数
    });

    const analysisResult = completion.choices[0].message.content;
    if (!analysisResult) {
      throw new Error("分析結果の取得に失敗しました");
    }

    const analysis = JSON.parse(analysisResult);

    console.log("Analysis completed:", analysis.summary);

    return NextResponse.json({
      success: true,
      data: {
        stockCode,
        analysis,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error: unknown) {
    console.error("Stock analysis error:", error);
    const errorMessage = error instanceof Error ? error.message : "分析処理でエラーが発生しました";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
