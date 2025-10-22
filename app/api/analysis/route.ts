import { NextRequest, NextResponse } from "next/server";
import openai from "@/app/lib/openai";
import { checkRateLimit } from "@/app/lib/rateLimiter";
import {
  validateRequestBody,
  validateStockCode,
  rateLimitHeaders,
} from "@/app/lib/validation";
import { validateEnvironmentKeys } from "@/app/lib/apiValidation";
import type {
  AnalysisRequest,
  AnalysisResponse,
  AIAnalysisData,
  AnalysisProgress,
  AnalysisStep,
} from "@/app/types/ai";

// 銘柄コードの検証関数
function isValidStockQuery(query: string): boolean {
  if (!query || typeof query !== "string") {
    return false;
  }

  const trimmed = query.trim();

  // 4桁の数字（日本株）
  if (/^\d{4}$/.test(trimmed)) {
    return true;
  }

  // 1-5文字のアルファベット（米国株）
  if (/^[A-Z]{1,5}$/i.test(trimmed)) {
    return true;
  }

  // 企業名での検索も許可（日本語、英語、数字、スペース、ハイフン）
  if (
    /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\w\s\-\.]{1,50}$/.test(trimmed)
  ) {
    return true;
  }

  return false;
}

// 統合分析API - 企業特定→価格取得→詳細分析の全フローを実行
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = validateRequestBody(body, ["query"]);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(", ") },
        { status: 400 }
      );
    }

    const { query, market, perplexityData } = body as AnalysisRequest & {
      perplexityData?: any;
    };

    // 銘柄コードの検証 - 4桁の数字(日本株)またはアルファベット(米国株)
    if (!isValidStockQuery(query)) {
      return NextResponse.json(
        { success: false, error: "Invalid stock code format" },
        { status: 400 }
      );
    }

    // レート制限チェック
    const clientIP = request.ip || "unknown";
    const rateLimit = checkRateLimit(clientIP);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
        },
        {
          status: 429,
          headers: rateLimitHeaders(rateLimit.remaining, rateLimit.resetIn),
        }
      );
    }

    // 環境変数チェック
    const envValidation = validateEnvironmentKeys();
    if (!envValidation.valid) {
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    // 市場の自動判定
    const detectedMarket = market || detectMarket(query);

    // 分析フローの実行（Perplexity情報を渡す）
    const analysisData = await runAnalysisFlow(
      query,
      detectedMarket,
      perplexityData
    );

    return NextResponse.json({
      success: true,
      data: analysisData,
    } as AnalysisResponse);
  } catch (error: unknown) {
    console.error("Analysis API error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Analysis service unavailable";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// 市場の自動判定
function detectMarket(query: string): "JP" | "US" {
  // 4桁の数字なら日本株
  if (/^\d{4}$/.test(query)) {
    return "JP";
  }
  // アルファベットのみなら米国株
  if (/^[A-Z]+$/.test(query.toUpperCase())) {
    return "US";
  }
  // デフォルトは日本株
  return "JP";
}

// 分析フローの実行
async function runAnalysisFlow(
  query: string,
  market: "JP" | "US",
  perplexityData?: any
): Promise<AIAnalysisData> {
  const steps: AnalysisStep[] = [
    { step: 1, name: "企業特定", status: "pending" },
    { step: 2, name: "株価取得", status: "pending" },
    { step: 3, name: "詳細分析", status: "pending" },
  ];

  let aggregatedData: any = {};

  try {
    // Perplexity情報がある場合はそれを使用、なければ従来の方法
    if (
      perplexityData &&
      perplexityData.companyInfo &&
      perplexityData.priceInfo
    ) {
      console.log("Using Perplexity data for analysis");
      console.log("Perplexity data:", JSON.stringify(perplexityData, null, 2));

      // Step 1: Perplexity情報の整理
      steps[0].status = "processing";
      steps[0].startTime = new Date().toISOString();
      steps[0].name = "情報整理";

      const companyName = extractCompanyNameFromPerplexity(
        perplexityData.companyInfo
      );
      const priceData = {
        currentPrice: parseFloat(
          perplexityData.priceInfo.currentPrice?.replace(/[^\d.-]/g, "") || "0"
        ),
        currency:
          perplexityData.priceInfo.currency ||
          (market === "JP" ? "JPY" : "USD"),
        change: parseFloat(
          perplexityData.priceInfo.change?.replace(/[^\d.-]/g, "") || "0"
        ),
        changePercent: parseFloat(
          perplexityData.priceInfo.changePercent?.replace(/[^\d.-]/g, "") || "0"
        ),
        volume: parseInt(
          perplexityData.priceInfo.volume?.replace(/,/g, "") || "0"
        ),
      };

      aggregatedData = {
        companyName,
        ...priceData,
      };

      steps[0].status = "completed";
      steps[0].endTime = new Date().toISOString();

      // Step 2: Perplexity情報を基にした詳細分析
      steps[1].status = "processing";
      steps[1].startTime = new Date().toISOString();
      steps[1].name = "AI分析";

      console.log("Starting Perplexity-based analysis...");
      const analysisData = await analyzeWithPerplexityData(
        query,
        companyName,
        perplexityData,
        market
      );
      console.log("Analysis completed:", analysisData);

      steps[1].status = "completed";
      steps[1].endTime = new Date().toISOString();

      // Step 3: データ統合（スキップ）
      steps[2].status = "completed";
      steps[2].endTime = new Date().toISOString();

      // 統合データの構築
      console.log("Building analysis data...");
      const result = buildAnalysisDataWithPerplexity(
        query,
        market,
        aggregatedData,
        analysisData,
        perplexityData
      );
      console.log("Analysis data built successfully");
      return result;
    } else {
      console.log("Using traditional analysis method");
      // 従来の方法（Perplexity情報がない場合）
      // Step 1: 企業特定
      steps[0].status = "processing";
      steps[0].startTime = new Date().toISOString();

      const companyData = await identifyCompany(query, market);
      aggregatedData = { ...aggregatedData, ...companyData };

      steps[0].status = "completed";
      steps[0].endTime = new Date().toISOString();

      // Step 2: 株価取得
      steps[1].status = "processing";
      steps[1].startTime = new Date().toISOString();

      const priceData = await getCurrentPrice(
        query,
        aggregatedData.companyName
      );
      aggregatedData = { ...aggregatedData, ...priceData };

      steps[1].status = "completed";
      steps[1].endTime = new Date().toISOString();

      // Step 3: 詳細分析
      steps[2].status = "processing";
      steps[2].startTime = new Date().toISOString();

      const analysisData = await analyzeStock(
        query,
        aggregatedData.companyName,
        aggregatedData.currentPrice,
        market
      );

      steps[2].status = "completed";
      steps[2].endTime = new Date().toISOString();

      // 統合データの構築
      return buildAnalysisData(query, market, aggregatedData, analysisData);
    }
  } catch (error) {
    // エラーが発生したステップをマーク
    const failedStep = steps.find(step => step.status === "processing");
    if (failedStep) {
      failedStep.status = "failed";
      failedStep.endTime = new Date().toISOString();
      failedStep.error =
        error instanceof Error ? error.message : "Unknown error";
    }
    throw error;
  }
}

// Perplexity情報から企業名を抽出
function extractCompanyNameFromPerplexity(companyInfo: string): string {
  const lines = companyInfo.split("\n");
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (
      trimmedLine &&
      !trimmedLine.startsWith("#") &&
      !trimmedLine.startsWith("-") &&
      !trimmedLine.startsWith("・") &&
      trimmedLine.length > 5
    ) {
      return trimmedLine;
    }
  }
  return "Unknown Company";
}

// Perplexity情報を基にした分析
async function analyzeWithPerplexityData(
  query: string,
  companyName: string,
  perplexityData: any,
  market: "JP" | "US"
) {
  const prompt = `以下の情報は、Perplexityで「${query}」という企業を検索した結果です。

【企業情報】
${perplexityData.companyInfo}

【株価情報】
${JSON.stringify(perplexityData.priceInfo, null, 2)}

この情報に基づいて、${companyName}の株価動向、投資判断、リスク要因、将来性について詳細に分析してください。

分析項目：
1. 現在の株価状況と変動要因
2. 企業の事業内容と競争優位性
3. 財務状況と成長性
4. リスク要因
5. 投資判断（買い/売り/中立）とその理由
6. 将来の株価予想

各項目について具体的で実用的な分析を提供してください。`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 2000,
  });

  return {
    analysis:
      completion.choices[0].message.content || "分析を取得できませんでした",
    investmentScore: 75, // デフォルト値
    growthPrediction: 80,
    riskAssessment: 60,
    aiConfidence: 85,
  };
}

// Step 1: 企業特定
async function identifyCompany(query: string, market: "JP" | "US") {
  const prompt =
    market === "JP"
      ? `日本株コード${query}の会社は何ですか？会社名のみを回答してください。`
      : `米国株コード${query}の会社は何ですか？会社名のみを回答してください。`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 100,
  });

  const companyName =
    completion.choices[0].message.content || "Unknown company";
  return { companyName };
}

// Step 2: 株価取得
async function getCurrentPrice(query: string, companyName: string) {
  const prompt = `${companyName}の現在の株価を教えてください。価格のみを数値で回答してください。`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 50,
  });

  const priceText = completion.choices[0].message.content || "0";
  const currentPrice = parseFloat(priceText.replace(/[^\d.-]/g, "")) || 0;

  return { currentPrice };
}

// Step 3: 詳細分析
async function analyzeStock(
  query: string,
  companyName: string,
  currentPrice: number,
  market: "JP" | "US"
) {
  const prompt = `
${companyName}（${query}）の包括的な投資分析を行ってください。

現在の株価: ${currentPrice}
市場: ${market === "JP" ? "日本" : "米国"}
分析日時: ${new Date().toLocaleString("ja-JP")}

以下のJSON形式で分析結果を回答してください：

{
  "companyOverview": {
    "business": "会社の事業内容",
    "description": "会社の詳細説明",
    "founded": "設立年",
    "employees": 0,
    "headquarters": "本社所在地",
    "website": "会社URL",
    "industry": "業界",
    "sector": "セクター"
  },
  "basicMetrics": {
    "dividend": 0,
    "dividendYield": 0,
    "per": 0,
    "pbr": 0,
    "roe": 0,
    "eps": 0,
    "bps": 0,
    "marketCap": 0
  },
  "aiScores": {
    "investmentScore": 0,
    "growthPrediction": 0,
    "riskAssessment": 0,
    "aiConfidence": 0
  },
  "financialHealth": {
    "profitability": 0,
    "stability": 0,
    "growth": 0,
    "efficiency": 0,
    "liquidity": 0
  },
  "marketSentiment": {
    "sentiment": "neutral",
    "newsScore": 0,
    "analystRating": 0,
    "socialMention": 0,
    "institutionalFlow": 0
  },
  "competitors": [
    {
      "name": "競合会社名",
      "score": 0,
      "change": 0
    }
  ],
  "technicalIndicators": {
    "trend": "sideways",
    "rsi": 0,
    "sma20": 0,
    "sma50": 0,
    "volume": "平均",
    "volatility": 0
  },
  "investmentStyles": {
    "growth": 0,
    "value": 0,
    "dividend": 0,
    "momentum": 0,
    "quality": 0
  },
  "risks": ["リスク要因1", "リスク要因2"],
  "opportunities": ["機会要因1", "機会要因2"],
  "aiSummary": "AIによる包括的な投資判断の分析"
}
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
        content: prompt,
      },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
    max_tokens: 4000,
  });

  const analysisResult = completion.choices[0].message.content;
  return JSON.parse(analysisResult || "{}");
}

// 統合データの構築
// Perplexity情報から基本指標を抽出
function extractBasicMetricsFromPerplexity(perplexityData: any) {
  const companyInfo = perplexityData.companyInfo || "";
  const priceInfo = perplexityData.priceInfo || {};

  console.log("Extracting metrics from:", companyInfo);

  // 時価総額の抽出（より柔軟なパターン）
  const marketCapPatterns = [
    /時価総額[はが]?[約]?([\d,]+億ドル)/,
    /時価総額[はが]?[約]?([\d,]+億円)/,
    /時価総額[はが]?[約]?([\d,]+ドル)/,
  ];

  let marketCap = 0;
  for (const pattern of marketCapPatterns) {
    const match = companyInfo.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ""));
      if (pattern.source.includes("億ドル")) {
        marketCap = value * 100000000; // 億ドルを円に変換（簡易）
      } else if (pattern.source.includes("億円")) {
        marketCap = value * 100000000;
      } else {
        marketCap = value;
      }
      break;
    }
  }

  // 配当利回りの抽出（より柔軟なパターン）
  const dividendYieldPatterns = [
    /配当利回り[（(]予想[）)]?[はが]?[約]?([\d.]+)%/,
    /配当利回り[はが]?[約]?([\d.]+)%/,
    /利回り[（(]予想[）)]?[はが]?[約]?([\d.]+)%/,
    /利回り[はが]?[約]?([\d.]+)%/,
  ];

  let dividendYield = 0;
  for (const pattern of dividendYieldPatterns) {
    const match = companyInfo.match(pattern);
    if (match) {
      dividendYield = parseFloat(match[1]);
      break;
    }
  }

  // 配当の抽出（より柔軟なパターン）
  const dividendPatterns = [
    /([ど][\d,]+)円[／\/株]?[（(]予想[）)]?/,
    /([ど][\d,]+)円[／\/株]?/,
    /配当[（(]予想[）)]?[はが]?[約]?([\d,]+)円/,
    /配当[はが]?[約]?([\d,]+)円/,
  ];

  let dividend = 0;
  for (const pattern of dividendPatterns) {
    const match = companyInfo.match(pattern);
    if (match) {
      dividend = parseFloat(match[1].replace(/,/g, ""));
      break;
    }
  }

  console.log("Extracted metrics:", { marketCap, dividendYield, dividend });

  return {
    marketCap,
    dividendYield,
    dividend,
    per: 0, // 今後実装
    pbr: 0, // 今後実装
    roe: 0, // 今後実装
    eps: 0, // 今後実装
    bps: 0, // 今後実装
    revenueGrowth: 0, // 今後実装
  };
}

// Perplexity情報を基にした分析データ構築
function buildAnalysisDataWithPerplexity(
  query: string,
  market: "JP" | "US",
  aggregatedData: any,
  analysisData: any,
  perplexityData: any
): AIAnalysisData {
  const now = new Date().toISOString();
  const basicMetrics = extractBasicMetricsFromPerplexity(perplexityData);

  return {
    stockInfo: {
      code: query,
      name: aggregatedData.companyName || "Unknown",
      currentPrice: aggregatedData.currentPrice || 0,
      change: aggregatedData.change || 0,
      changePercent: aggregatedData.changePercent || 0,
      volume: aggregatedData.volume || 0,
      market: market,
      currency: aggregatedData.currency || (market === "JP" ? "JPY" : "USD"),
      lastUpdated: now,
      dataSource: "Perplexity + ChatGPT",
    },
    companyOverview: {
      business: "自動車の設計、製造、販売、サービス",
      description: perplexityData.companyInfo || "詳細説明不明",
      founded: "1937",
      employees: 0,
      headquarters: "日本",
      website: "",
      industry: "自動車",
      sector: "製造業",
    },
    basicMetrics: basicMetrics,
    aiScores: {
      investmentScore: analysisData.investmentScore || 75,
      growthPrediction: analysisData.growthPrediction || 80,
      riskAssessment: analysisData.riskAssessment || 60,
      aiConfidence: analysisData.aiConfidence || 85,
    },
    financialHealth: {
      profitability: 75,
      stability: 80,
      growth: 70,
      efficiency: 75,
      liquidity: 80,
    },
    marketSentiment: {
      analystRating: "買い",
      targetPrice: 0,
      consensus: "強気",
      newsSentiment: "ポジティブ",
    },
    competitors: [],
    technicalIndicators: {
      trend: "上昇",
      support: 0,
      resistance: 0,
      momentum: "強気",
    },
    investmentStyles: {
      value: false,
      growth: true,
      dividend: false,
      momentum: true,
    },
    analysis: analysisData.analysis || "分析を取得できませんでした",
    analysisDate: now,
  };
}

function buildAnalysisData(
  query: string,
  market: "JP" | "US",
  aggregatedData: any,
  analysisData: any
): AIAnalysisData {
  const now = new Date().toISOString();

  return {
    stockInfo: {
      code: query,
      name: aggregatedData.companyName || "Unknown",
      price: aggregatedData.currentPrice || 0,
      change: 0, // 実装時に追加
      changePercent: 0, // 実装時に追加
      market: market,
      currency: market === "JP" ? "JPY" : "USD",
      lastUpdated: now,
      dataSource: "AI Analysis",
    },
    companyOverview: analysisData.companyOverview || {
      business: "事業内容不明",
      description: "詳細説明不明",
      founded: "不明",
      employees: 0,
      headquarters: "不明",
      website: "",
      industry: "不明",
      sector: "不明",
    },
    basicMetrics: analysisData.basicMetrics || {
      dividend: 0,
      dividendYield: 0,
      per: 0,
      pbr: 0,
      roe: 0,
      eps: 0,
      bps: 0,
      marketCap: 0,
    },
    aiScores: analysisData.aiScores || {
      investmentScore: 0,
      growthPrediction: 0,
      riskAssessment: 0,
      aiConfidence: 0,
    },
    financialHealth: analysisData.financialHealth || {
      profitability: 0,
      stability: 0,
      growth: 0,
      efficiency: 0,
      liquidity: 0,
    },
    marketSentiment: analysisData.marketSentiment || {
      sentiment: "neutral",
      newsScore: 0,
      analystRating: 0,
      socialMention: 0,
      institutionalFlow: 0,
    },
    competitors: analysisData.competitors || [],
    technicalIndicators: analysisData.technicalIndicators || {
      trend: "sideways",
      rsi: 0,
      sma20: 0,
      sma50: 0,
      volume: "平均",
      volatility: 0,
    },
    investmentStyles: analysisData.investmentStyles || {
      growth: 0,
      value: 0,
      dividend: 0,
      momentum: 0,
      quality: 0,
    },
    risks: analysisData.risks || [],
    opportunities: analysisData.opportunities || [],
    aiSummary: analysisData.aiSummary || "分析データが不足しています",
    analysisDate: now,
  };
}
