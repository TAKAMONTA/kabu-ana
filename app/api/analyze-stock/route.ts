import { NextRequest, NextResponse } from "next/server";
import { getPerplexityClient } from "@/app/lib/perplexity";
import OpenAI from "openai";

// 株価分析のためのAPIエンドポイント
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, step = 1, previousData } = body;

    // 入力検証
    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "分析対象の株コードが入力されていません",
        },
        { status: 400 }
      );
    }

    // APIキーの確認
    if (!process.env.PERPLEXITY_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "Perplexity APIキーが設定されていません",
        },
        { status: 500 }
      );
    }

    const perplexity = getPerplexityClient();

    // 日本株か米国株かを判定
    const isJapaneseCode = /^\d{4}$/.test(query);
    const isUSSymbol = /^[A-Z]{1,5}$/.test(query);

    console.log(`分析ステップ${step} 実行中: ${query}`);

    switch (step) {
      case 1: {
        // ステップ1: 基本情報の取得
        let basicInfoQuery: string;
        if (isJapaneseCode) {
          basicInfoQuery = `日本株 日本株コード${query} の会社の事業内容と会社概要を教えてください`;
        } else if (isUSSymbol) {
          basicInfoQuery = `米国株 米国株コード ${query} の会社の事業内容と会社概要を教えてください`;
        } else {
          basicInfoQuery = `会社・${query}・の事業内容と会社概要を教えてください`;
        }

        const response = await perplexity.search(basicInfoQuery);
        const content = response.choices[0]?.message?.content || "";

        return NextResponse.json({
          success: true,
          step: 1,
          stepName: "基本情報取得",
          data: {
            companyOverview: content,
          },
          nextStep: 2,
          message: "基本情報を取得しました。次は最新ニュースを取得します。",
        });
      }

      case 2: {
        // ステップ2: 最新ニュースと市場動向
        let newsQuery: string;
        if (isJapaneseCode) {
          newsQuery = `日本株 日本株コード${query} の最新ニュースと市場動向と株価変動を教えてください`;
        } else if (isUSSymbol) {
          newsQuery = `米国株 米国株コード ${query} の最新ニュースと市場動向と株価変動を教えてください`;
        } else {
          newsQuery = `会社・${query}・の最新ニュースと市場動向と株価変動を教えてください`;
        }

        const response = await perplexity.search(newsQuery);
        const content = response.choices[0]?.message?.content || "";

        return NextResponse.json({
          success: true,
          step: 2,
          stepName: "最新ニュース取得",
          data: {
            latestNews: content,
          },
          nextStep: 3,
          message: "最新ニュースを取得しました。次は財務指標を分析します。",
        });
      }

      case 3: {
        // ステップ3: 財務指標と分析
        let financialQuery: string;
        if (isJapaneseCode) {
          financialQuery = `日本株 日本株コード${query} の財務指標（ROE、PER、PBR、配当利回りなど）を教えてください`;
        } else if (isUSSymbol) {
          financialQuery = `米国株 米国株コード ${query} の財務指標（ROE、PER、PBR、配当利回りなど）を教えてください`;
        } else {
          financialQuery = `会社・${query}・の財務指標（ROE、PER、PBR、配当利回りなど）を教えてください`;
        }

        const response = await perplexity.search(financialQuery);
        const content = response.choices[0]?.message?.content || "";

        return NextResponse.json({
          success: true,
          step: 3,
          stepName: "財務指標分析",
          data: {
            financialData: content,
          },
          nextStep: 4,
          message: "財務指標を分析しました。次は競合分析を行います。",
        });
      }

      case 4: {
        // ステップ4: 競合他社との比較分析
        let competitorQuery: string;
        if (isJapaneseCode) {
          competitorQuery = `日本株 日本株コード${query} の主要な競合他社とその比較分析を教えてください`;
        } else if (isUSSymbol) {
          competitorQuery = `米国株 米国株コード ${query} の主要な競合他社とその比較分析を教えてください`;
        } else {
          competitorQuery = `会社・${query}・の主要な競合他社とその比較分析を教えてください`;
        }

        const response = await perplexity.search(competitorQuery);
        const content = response.choices[0]?.message?.content || "";

        return NextResponse.json({
          success: true,
          step: 4,
          stepName: "競合分析",
          data: {
            competitorAnalysis: content,
          },
          nextStep: 5,
          message: "競合分析を完了しました。次はAI総合分析を行います。",
        });
      }

      case 5: {
        // ステップ5: OpenAIによる総合分析
        if (!process.env.OPENAI_API_KEY) {
          return NextResponse.json({
            success: true,
            step: 5,
            stepName: "AI総合分析",
            data: {
              analysis:
                "OpenAI APIキーが設定されていないため、簡易版の総合分析を提供します。",
            },
            nextStep: null,
            message: "分析が完了しました。",
          });
        }

        // previousDataを活用して分析

        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        const analysisPrompt = `
以下の情報を基に、${query}の投資判断に役立つ総合的な分析を行ってください。
分析結果は以下のJSON形式で回答してください。

{
  "investmentScore": 数値（-100〜100）,
  "recommendation": "BUY" | "HOLD" | "SELL",
  "summary": "総合的な投資判断の要約（100文字以内）",

  "swotAnalysis": {
    "strengths": ["強み1", "強み2", "強み3"],
    "weaknesses": ["弱み1", "弱み2", "弱み3"],
    "opportunities": ["機会1", "機会2", "機会3"],
    "threats": ["脅威1", "脅威2", "脅威3"]
  },

  "financialHealth": {
    "profitability": "高/中/低の評価",
    "growthRate": "成長率の評価",
    "debtLevel": "負債水準の評価",
    "cashFlow": "キャッシュフローの評価"
  },

  "riskAnalysis": {
    "marketRisk": "市場リスクの説明",
    "businessRisk": "事業リスクの説明",
    "financialRisk": "財務リスクの説明",
    "overallRiskLevel": "高/中/低"
  },

  "technicalIndicators": {
    "trend": "上昇/下降/横ばい",
    "momentum": "強い/弱い",
    "support": "サポートライン",
    "resistance": "レジスタンスライン"
  },

  "valuation": {
    "currentValuation": "割安/適正/割高",
    "targetPrice": "目標株価",
    "upside": "上昇余地"
  },

  "investmentHorizon": {
    "shortTerm": "短期-3ヶ月以内の判断",
    "mediumTerm": "中期-12ヶ月以内の判断",
    "longTerm": "長期-1年以上の判断"
  },

  "keyPoints": [
    "重要なポイント1",
    "重要なポイント2",
    "重要なポイント3"
  ]
}

以下の情報も参考にしてください。
${previousData ? JSON.stringify(previousData, null, 2) : "情報がありません"}

分析結果はJSON形式で、上記の項目を含めて回答してください。
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
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: "json_object" },
        });

        const analysisText = completion.choices[0]?.message?.content || "{}";
        let analysis;

        try {
          analysis = JSON.parse(analysisText);
        } catch (e) {
          // JSONパースに失敗した場合、テキストとして扱う
          analysis = { comprehensiveAnalysis: analysisText };
        }

        return NextResponse.json({
          success: true,
          step: 5,
          stepName: "AI総合分析",
          data: analysis,
          nextStep: null,
          message: "すべての分析が完了しました。",
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: "無効なステップ番号です",
          },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    console.error("Analysis error:", error);
    const errorMessage = error instanceof Error ? error.message : "分析処理でエラーが発生しました";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.message : "不明なエラー",
      },
      { status: 500 }
    );
  }
}
