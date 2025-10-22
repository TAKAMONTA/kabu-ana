// AI分析プロンプト生成
// ステップ1: 企業の特定
export const identifyCompanyPrompt = (
  stockCode: string,
  market: "JP" | "US"
) => {
  if (market === "JP") {
    return `日本株の${stockCode}の企業名を教えてください。企業名のみを回答してください。`;
  } else {
    return `米国株の${stockCode}の企業名を教えてください。企業名のみを回答してください。`;
  }
};

// ステップ2: 現在の株価
export const getCurrentPricePrompt = (
  companyName: string,
  stockCode: string
) => {
  return `${companyName}（${stockCode}）の現在の株価を教えてください。株価と前日比の変化率を教えてください。`;
};

// ステップ3: カード生成
export const generateKartePrompt = (
  stockCode: string,
  stockName: string,
  currentPrice: number,
  market: "JP" | "US"
) => {
  return `
以下の株価情報を基に、包括的な投資判断のためのAI分析カードを生成してください。

基本情報:
- 株式コード: ${stockCode}
- 企業名: ${stockName}
- 現在株価: ${currentPrice}円
- 市場: ${market === "JP" ? "日本株" : "米国株"}

以下の項目を分析してJSON形式で回答してください。数値は適切な範囲で、テキストは簡潔に作成してください。
{
  "stockInfo": {
    "code": "${stockCode}",
    "name": "${stockName}",
    "price": [現在の株価を数値で],
    "changePercent": [前日比の変化率を数値で],
    "market": "${market}",
    "lastUpdated": "[YYYY-MM-DD HH:mm:ss形式]"
  },
  "companyOverview": {
    "business": "[事業内容を0文字で簡潔に]",
    "description": "[企業の概要説明、業界、セクター、特徴を50文字以内で簡潔に]",
    "founded": "[設立年]",
    "employees": [従業員数を数値で],
    "headquarters": "[本社所在地]",
    "website": "[ウェブサイトURL]",
    "industry": "[業種]",
    "sector": "[セクター]"
  },
  "basicMetrics": {
    "dividend": [1株当たり配当を数値で],
    "dividendYield": [配当利回りを数値で],
    "per": [PERを数値で],
    "pbr": [PBRを数値で],
    "roe": [ROEを数値で],
    "eps": [EPSを数値で],
    "bps": [BPSを数値で],
    "marketCap": [時価総額を数値で],
    "revenueGrowth": [売上成長率を数値で]
  },
  "aiScores": {
    "totalScore": [総合投資スコア0-10の数値で],
    "growthPotential": [成長性スコア0-10の数値で],
    "profitability": [収益性スコア0-10の数値で],
    "stability": [安定性スコア0-10の数値で],
    "value": [割安性スコア0-10の数値で],
    "aiConfidence": [分析の信頼度0-1の数値で]
  },
  "financialHealth": {
    "debtToEquity": [負債比率を数値で],
    "currentRatio": [流動比率を数値で],
    "cashFlow": [キャッシュフローを数値で],
    "interestCoverage": [利息カバー率を数値で]
  },
  "marketSentiment": {
    "sentiment": "[bullish/neutral/bearishのいずれか]",
    "newsScore": [ニュース評価0-10の数値で],
    "analystRating": [アナリスト評価0-5の数値で],
    "socialMention": [SNS言及度0-10の数値で],
    "institutionalFlow": [機関投資家の流れ-10から10の数値で]
  },
  "competitors": [
    {
      "name": "[競合企業名]",
      "score": [競合スコア0-10の数値で],
      "change": [変化率-100から100の数値で]
    }
  ],
  "technicalIndicators": {
    "trend": "[uptrend/sideways/downtrendのいずれか]",
    "rsi": [RSI値0-100の数値で],
    "sma20": [20日移動平均線を数値で],
    "sma50": [50日移動平均線を数値で],
    "volume": "[出来高の状況を文字で]",
    "volatility": [ボラティリティを数値で]
  },
  "investmentStyles": {
    "growth": [グロース投資適性0-5の数値で],
    "value": [バリュー投資適性0-5の数値で],
    "dividend": [配当投資適性0-5の数値で],
    "momentum": [モメンタム投資適性0-5の数値で],
    "quality": [クオリティ投資適性0-5の数値で]
  },
  "risks": [
    "[主要リスク1]",
    "[主要リスク2]",
    "[主要リスク3]",
    "[主要リスク4]",
    "[主要リスク5]"
  ],
  "opportunities": [
    "[投資機会1]",
    "[投資機会2]",
    "[投資機会3]",
    "[投資機会4]",
    "[投資機会5]"
  ],
  "aiSummary": "[投資判断の総合的な分析結果を100文字以内で、簡潔で分かりやすい説明を作成]"
}

分析のポイント:
1. 市場の特性を考慮した分析
2. 包括的な投資指標の評価
3. リスクと機会をバランスよく分析
4. 日本株の投資家向けに分かりやすい説明
5. データに基づいた客観的な分析
適切なJSON形式で回答し、不要な説明は省いてください。`;
};

// 段階的API呼び出し処理の実装
export const callAIAnalysisStepByStep = async (
  stockCode: string,
  market: "JP" | "US"
) => {
  try {
    // ステップ1: 企業名取得
    const companyPrompt = identifyCompanyPrompt(stockCode, market);
    console.log("ステップ1 - 企業名取得", companyPrompt);

    // const companyResponse = await callAPI(companyPrompt);
    // const companyName = extractCompanyName(companyResponse);
    const companyName = ""; // APIコールの代わり

    // ステップ2: 現在の株価取得
    const pricePrompt = getCurrentPricePrompt(companyName, stockCode);
    console.log("ステップ2 - 株価取得", pricePrompt);

    // const priceResponse = await callAPI(pricePrompt);
    // const { currentPrice, changePercent } = extractPriceInfo(priceResponse);
    const currentPrice = 0; // APIコールの代わり

    // ステップ3: カードが生成
    const analysisPrompt = generateKartePrompt(
      stockCode,
      companyName,
      currentPrice,
      market
    );
    console.log("ステップ3 - カード生成:", analysisPrompt);

    // const analysisResponse = await callAPI(analysisPrompt);
    // return parseAnalysisResponse(analysisResponse);

    return null; // 実際のAPIコールに置き換える
  } catch (error) {
    console.error("段階的AI分析エラー:", error);
    throw error;
  }
};

// 外部API呼び出し処理
const callAPI = async (prompt: string) => {
  // OpenAI/Claude/Gemini APIの呼び出し
  // const response = await fetch(API_ENDPOINT, {
  //   method: 'POST',
  //   headers: { ... },
  //   body: JSON.stringify({ prompt })
  // });
  // return await response.json();
  return null;
};

// 企業名を抽出するヘルパー関数
const extractCompanyName = (response: { companyName?: string }): string => {
  return response.companyName || "";
};

// 株価情報を抽出するヘルパー関数
const extractPriceInfo = (
  response: { price?: number; change?: number }
): { currentPrice: number; changePercent: number } => {
  return {
    currentPrice: response.price || 0,
    changePercent: response.change || 0,
  };
};

// 分析レスポンスをパースするヘルパー関数
const parseAnalysisResponse = (response: any) => {
  try {
    if (typeof response === "string") {
      return JSON.parse(response);
    }
    return response;
  } catch (error) {
    console.error("JSON parse error:", error);
    return null;
  }
};

// レスポンス検証のヘルパー関数
export const validateAIResponse = (response: Record<string, any>): boolean => {
  const requiredFields = [
    "stockInfo",
    "companyOverview",
    "basicMetrics",
    "aiScores",
    "financialHealth",
    "marketSentiment",
    "competitors",
    "technicalIndicators",
    "investmentStyles",
    "risks",
    "opportunities",
    "aiSummary",
  ];

  for (const field of requiredFields) {
    if (!response[field]) {
      console.error(`Missing required field: ${field}`);
      return false;
    }
  }

  if (
    typeof response.aiScores.totalScore !== "number" ||
    response.aiScores.totalScore < 0 ||
    response.aiScores.totalScore > 10
  ) {
    console.error("Invalid totalScore");
    return false;
  }

  const validSentiments = ["bullish", "neutral", "bearish"];
  if (!validSentiments.includes(response.marketSentiment.sentiment)) {
    console.error("Invalid sentiment value");
    return false;
  }

  const validTrends = ["uptrend", "sideways", "downtrend"];
  if (!validTrends.includes(response.technicalIndicators.trend)) {
    console.error("Invalid trend value");
    return false;
  }

  return true;
};

// エラーフォールバックのレスポンス
export const getErrorFallback = (stockCode: string, stockName: string) => {
  return {
    stockInfo: {
      code: stockCode,
      name: stockName,
      price: 0,
      changePercent: 0,
      market: "JP",
      lastUpdated: new Date().toISOString(),
    },
    error: true,
    message:
      "AI分析でエラーが発生しました。しばらく時間をおいて再度お試しください。",
  };
};
