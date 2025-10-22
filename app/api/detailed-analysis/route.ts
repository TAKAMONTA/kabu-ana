import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/app/lib/rateLimiter";
import openai from "@/app/lib/openai";

// シンプルな詳細分析 API エンドポイント
export async function GET(request: NextRequest) {
  try {
    // レート制限チェック
    const clientId = request.headers.get("x-forwarded-for") || "anonymous";
    const rateLimit = checkRateLimit(clientId);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Please try again in ${rateLimit.resetIn} seconds`,
          resetIn: rateLimit.resetIn,
        },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const stockCode = searchParams.get("id");

    if (!stockCode) {
      return NextResponse.json(
        { error: "銘柄コードが指定されていません" },
        { status: 400 }
      );
    }

    // 市場を判定（4桁の数字なら日本株、それ以外は米国株）
    const market = /^\d{4}$/.test(stockCode) ? "JP" : "US";

    // 会社名を取得（URLデコード）
    const companyName = decodeURIComponent(stockCode);

    // シンプルな分析を実行
    return await performSimpleAnalysis(companyName, stockCode, market);
  } catch (error) {
    console.error("Simple analysis error:", error);
    return NextResponse.json(
      { success: false, error: "分析処理でエラーが発生しました" },
      { status: 500 }
    );
  }
}

// シンプルな分析実行
async function performSimpleAnalysis(
  companyName: string,
  stockCode: string,
  market: "JP" | "US"
) {
  try {
    console.log(`Starting simple analysis for ${companyName} (${stockCode})`);

    // OpenAI API キー確認
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API キーが設定されていません" },
        { status: 500 }
      );
    }

    // より具体的な分析プロンプト
    const analysisPrompt = `
以下の企業について、実際の企業情報を基に投資判断に役立つ分析を行ってください。

企業名: ${companyName}
銘柄コード: ${stockCode}
市場: ${market === "JP" ? "日本株" : "米国株"}

${companyName}について以下の点を考慮して分析してください：
1. 実際の事業内容と主要製品・サービス
2. 業界での地位と競合状況
3. 最近の業績動向と財務状況
4. 業界特有のリスクと機会
5. 投資家が注目すべきポイント

以下のJSON形式で回答してください：

{
  "companyInfo": {
    "name": "${companyName}",
    "industry": "業界名",
    "business": "主要事業内容",
    "description": "企業概要（100文字以内）"
  },
  "stockInfo": {
    "code": "${stockCode}",
    "name": "${companyName}",
    "price": 1000,
    "changePercent": 0,
    "market": "${market}",
    "lastUpdated": "${new Date().toLocaleString("ja-JP")}",
    "dataSource": "AI Analysis"
  },
  "basicMetrics": {
    "dividend": 0,
    "dividendYield": 0,
    "per": 0,
    "pbr": 0,
    "roe": 0,
    "eps": 0,
    "bps": 0,
    "marketCap": 0,
    "revenueGrowth": 0
  },
  "aiScores": {
    "totalScore": 5,
    "growthPotential": 5,
    "profitability": 5,
    "stability": 5,
    "value": 5,
    "aiConfidence": 0.5
  },
  "marketSentiment": {
    "sentiment": "neutral",
    "newsScore": 50,
    "analystRating": 3,
    "socialMention": 50,
    "institutionalFlow": 50
  },
  "risks": [
    "市場リスク",
    "業績変動リスク",
    "競合リスク"
  ],
  "opportunities": [
    "新市場への展開機会",
    "技術革新による競争力向上",
    "業界全体の成長トレンド"
  ],
  "aiSummary": "AI分析による投資判断の要約"
}

重要な点:
- JSON形式で回答してください
- 数値は適切な範囲で設定してください
- 分析は客観的で実用的な内容にしてください
- 企業名は必ず "${companyName}" をそのまま使用してください
- companyInfo.name と stockInfo.name は必ず "${companyName}" にしてください
- 企業固有の実際の情報を基に分析してください（汎用的な内容は避ける）
- 業界特有のリスクと機会を含めてください
- 財務指標は現実的な範囲で設定してください
`;

    // OpenAI APIで分析実行（モデルは環境変数で上書き可能）
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY が未設定です (.env.local に設定し再起動してください)",
        },
        { status: 500 }
      );
    }
    const model = process.env.OPENAI_MODEL || "gpt-4o";
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "あなたは株式分析の専門家です。正確で実用的な分析を提供してください。",
        },
        {
          role: "user",
          content: analysisPrompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const aiResponse = response.choices[0]?.message?.content;
    if (!aiResponse) {
      throw new Error("AI response is empty");
    }

    // JSON解析
    let analysisData;
    try {
      analysisData = JSON.parse(aiResponse);

      // デバッグ情報を出力
      console.log("AI Response parsed successfully:", analysisData);
      console.log("Company name in response:", analysisData.stockInfo?.name);

      // 企業名の検証と修正
      if (
        analysisData.stockInfo?.name &&
        typeof analysisData.stockInfo.name === "string"
      ) {
        // 企業名に問題がないかチェック
        if (
          analysisData.stockInfo.name.includes("function") ||
          analysisData.stockInfo.name.includes("=>") ||
          analysisData.stockInfo.name === "企業名"
        ) {
          console.log("Invalid company name detected, using fallback");
          analysisData.stockInfo.name = companyName;
        }
      } else {
        console.log("No valid company name in response, using fallback");
        analysisData.stockInfo = analysisData.stockInfo || {};
        analysisData.stockInfo.name = companyName;
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Raw AI response:", aiResponse);
      // フォールバック: デフォルトデータを返す
      analysisData = createDefaultAnalysisData(companyName, stockCode, market);
    }

    return NextResponse.json({
      success: true,
      analysisType: "simple_ai",
      karteData: analysisData,
      dataSource: "Simple AI Analysis",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Simple analysis failed:", error);

    // エラー時はデフォルトデータを返す
    const defaultData = createDefaultAnalysisData(
      companyName,
      stockCode,
      market
    );

    return NextResponse.json({
      success: true,
      analysisType: "default",
      karteData: defaultData,
      dataSource: "Default Analysis (AI Failed)",
      timestamp: new Date().toISOString(),
    });
  }
}

// デフォルト分析データの作成
function createDefaultAnalysisData(
  companyName: string,
  stockCode: string,
  market: "JP" | "US"
) {
  return {
    companyInfo: {
      name: companyName,
      industry: "情報取得中",
      business: "主要事業を分析中",
      description: `${companyName}の企業情報を取得中です。詳細な分析を準備しています。`,
    },
    stockInfo: {
      code: stockCode,
      name: companyName,
      price: market === "US" ? 100 : 1000,
      changePercent: 0,
      market: market,
      lastUpdated: new Date().toLocaleString("ja-JP"),
      dataSource: "Default Analysis",
    },
    basicMetrics: {
      dividend: 0,
      dividendYield: 0,
      per: 0,
      pbr: 0,
      roe: 0,
      eps: 0,
      bps: 0,
      marketCap: 0,
      revenueGrowth: 0,
    },
    aiScores: {
      totalScore: 5,
      growthPotential: 5,
      profitability: 5,
      stability: 5,
      value: 5,
      aiConfidence: 0.3,
    },
    marketSentiment: {
      sentiment: "neutral",
      newsScore: 50,
      analystRating: 3,
      socialMention: 50,
      institutionalFlow: 50,
    },
    risks: ["市場リスク", "業績変動リスク", "競合リスク"],
    opportunities: [
      "新市場への展開機会",
      "技術革新による競争力向上",
      "業界全体の成長トレンド",
    ],
    aiSummary: `${companyName}の分析を準備中です。詳細な投資判断レポートを提供予定です。`,
  };
}

export async function POST(request: NextRequest) {
  // POSTリクエストはGETと同じ処理
  return GET(request);
}
