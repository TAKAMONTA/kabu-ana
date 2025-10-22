// UTF-8 共通ビルダー: 検索/分析の生データから AIAnalysisData を構築
import type { AIAnalysisData, TechnicalIndicators } from "@/app/types/ai";

export interface StockSearchResultLite {
  query: string;
  priceInfo?: { volume?: string };
}

export function buildAIKarteData(
  stock: StockSearchResultLite,
  data: any
): AIAnalysisData {
  const market = /^\d{4}$/.test(stock.query)
    ? "JP"
    : /^[A-Z]{1,5}$/.test(stock.query)
      ? "US"
      : "JP";

  // 価格情報の取得（複数のパターンに対応）
  const priceText = String(data?.price?.current ?? data?.currentPrice ?? "");
  const priceNum = parseFloat(String(priceText).replace(/[^\d.\-]/g, ""));
  const changePct = (() => {
    const t = String(
      data?.price?.changePercent ?? data?.changePercent ?? ""
    ).replace(/[%\s]/g, "");
    const v = parseFloat(t);
    return Number.isFinite(v) ? v : 0;
  })();

  const invScore: number | undefined =
    typeof data.investmentScore === "number" ? data.investmentScore : undefined;
  const totalScore =
    typeof invScore === "number"
      ? Math.max(0, Math.min(10, (invScore + 100) / 20))
      : undefined;
  const recommendation: string | undefined =
    typeof data.recommendation === "string" ? data.recommendation : undefined;
  const keyPoints: string[] = Array.isArray(data?.keyPoints)
    ? data.keyPoints
    : [];
  const valuation = data?.valuation;
  const summaryBase =
    typeof data.summary === "string"
      ? data.summary
      : data.comprehensiveAnalysis || "";
  const recText = recommendation ? ` 推奨: ${recommendation}` : "";
  const valText =
    valuation?.targetPrice || valuation?.upside
      ? ` 目標: ${valuation?.targetPrice ?? "-"} / Upside: ${
          valuation?.upside ?? "-"
        }`
      : "";
  const kpText = keyPoints.length
    ? ` 重要ポイント: ${keyPoints.slice(0, 3).join("、")}`
    : "";
  const aiSummary = [summaryBase, recText, valText, kpText]
    .filter(Boolean)
    .join("\n");

  const trendText: string | undefined = data?.technicalIndicators?.trend;
  const trend: TechnicalIndicators["trend"] =
    trendText === "上昇"
      ? "uptrend"
      : trendText === "下落"
        ? "downtrend"
        : "sideways";

  const risks: string[] = Array.isArray(data?.swotAnalysis?.weaknesses)
    ? data.swotAnalysis.weaknesses.concat(
        Array.isArray(data?.swotAnalysis?.threats)
          ? data.swotAnalysis.threats
          : []
      )
    : [];
  const opportunities: string[] = Array.isArray(
    data?.swotAnalysis?.opportunities
  )
    ? data.swotAnalysis.opportunities
    : [];

  const aiConfidence =
    typeof invScore === "number"
      ? Math.min(10, Math.max(0, Math.round((Math.abs(invScore) / 100) * 10)))
      : 7;

  // ニュース情報の取得
  const latestNewsText =
    typeof (data?.latestNews ?? data?.news) === "string"
      ? (data.latestNews ?? data.news)
      : "";
  const newsScore = parseNewsScore(latestNewsText);
  const sentiment = parseSentimentFromNews(latestNewsText);

  // 競合分析の取得
  const competitorText =
    typeof data?.competitorAnalysis === "string" ? data.competitorAnalysis : "";
  const parsedCompetitors = parseCompetitors(competitorText, stock.query).slice(
    0,
    3
  );

  // 企業概要と財務データの取得
  const overviewText =
    typeof data.companyOverview === "string" ? data.companyOverview : "";
  const financialText =
    typeof data.financialData === "string" ? data.financialData : "";

  // エラーハンドリング付きで解析
  let ov, fm;
  try {
    ov = parseCompanyOverviewText(overviewText);
    fm = parseFinancialMetrics(financialText);
  } catch (error) {
    console.error("データ解析エラー:", error);
    ov = {
      industry: "不明",
      sector: "不明",
      founded: "不明",
      employees: 0,
      headquarters: "不明",
      website: "不明",
    };
    fm = {
      per: 0,
      pbr: 0,
      roe: 0,
      dividend: 0,
      dividendYield: 0,
      revenueGrowth: 0,
      marketCap: 0,
      eps: 0,
      bps: 0,
    };
  }

  // 投資スタイル傾向の計算
  const investmentStyles = calculateInvestmentStyles(
    fm,
    overviewText,
    latestNewsText
  );

  // リスクと機会の詳細化
  const { detailedRisks, detailedOpportunities } =
    generateDetailedRisksAndOpportunities(
      data?.swotAnalysis,
      overviewText,
      latestNewsText,
      fm
    );

  // 市場センチメントの詳細化
  const marketSentiment = generateMarketSentiment(
    latestNewsText,
    data?.technicalIndicators,
    fm
  );

  // 財務健全性の詳細化
  const financialHealth = generateFinancialHealth(fm, overviewText);

  // 競合比較の詳細化
  const enhancedCompetitors = generateEnhancedCompetitors(
    parsedCompetitors,
    competitorText,
    stock.query
  );

  // デバッグ用ログ（一時的）
  console.log("buildAIKarteData - 受信データ:", {
    companyOverview: overviewText.substring(0, 100) + "...",
    financialData: financialText.substring(0, 100) + "...",
    latestNews: latestNewsText.substring(0, 100) + "...",
    competitorAnalysis: competitorText.substring(0, 100) + "...",
    investmentScore: data.investmentScore,
    recommendation: data.recommendation,
    parsedOverview: ov,
    parsedFinancial: fm,
    marketSentiment,
    financialHealth,
    enhancedCompetitors,
  });

  // 財務データの詳細デバッグ
  console.log("財務データ詳細デバッグ:", {
    financialTextLength: financialText.length,
    financialTextSample: financialText.substring(0, 500),
    parsedFinancialMetrics: fm,
    hasValidData: Object.values(fm).some(v => v !== undefined && v !== 0),
  });

  // 企業名の自動抽出
  const companyName = (() => {
    if (overviewText) {
      // 企業名のパターンを複数試行
      const patterns = [
        /(?:企業名|会社名|Company)[:：]\s*([^\n，、。]+)/i,
        /^([^（(]+?)(?:（|\(|株式会社|有限会社|Inc\.|Corp\.)/,
        /(?:^|\n)([A-Za-z\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+(?:株式会社|有限会社|Inc\.|Corp\.)?)/,
      ];

      for (const pattern of patterns) {
        const match = overviewText.match(pattern);
        if (match && match[1] && match[1].trim().length > 1) {
          return match[1].trim();
        }
      }
    }
    return stock.query; // フォールバック
  })();

  return {
    stockInfo: {
      code: stock.query,
      name: companyName,
      price: priceNum || 0,
      change: 0, // 実装時に追加
      changePercent: changePct,
      market,
      currency: market === "JP" ? "JPY" : "USD",
      lastUpdated: new Date().toLocaleString("ja-JP"),
      dataSource: "AI Analysis",
    },
    companyOverview: {
      business: data.companyOverview
        ? String(data.companyOverview)
        : "主要事業",
      description: data.companyOverview
        ? String(data.companyOverview)
        : "企業情報を分析中です",
      founded: ov.founded || "不明",
      employees: ov.employees ?? 0,
      headquarters: ov.headquarters || "不明",
      website: ov.website || "",
      industry: ov.industry || "不明",
      sector: ov.sector || "不明",
    },
    basicMetrics: {
      dividend: fm.dividend ?? 0,
      dividendYield: fm.dividendYield ?? 0,
      per: fm.per ?? getDefaultPER(stock.query),
      pbr: fm.pbr ?? getDefaultPBR(stock.query),
      roe: fm.roe ?? getDefaultROE(stock.query),
      eps: fm.eps ?? getDefaultEPS(stock.query),
      bps: fm.bps ?? getDefaultBPS(stock.query),
      marketCap: fm.marketCap ?? getDefaultMarketCap(stock.query),
      revenueGrowth: fm.revenueGrowth ?? getDefaultRevenueGrowth(stock.query),
    },
    aiScores: {
      investmentScore: totalScore ? totalScore * 10 : 50, // 5.0 -> 50
      growthPrediction: totalScore ? totalScore : 5,
      riskAssessment: totalScore ? 10 - totalScore : 5,
      aiConfidence,
    },
    financialHealth,
    marketSentiment,
    competitors: enhancedCompetitors,
    technicalIndicators: {
      trend,
      rsi: calculateRSI(priceNum, changePct),
      sma20: calculateSMA(priceNum, 20) || getDefaultSMA20(stock.query),
      sma50: calculateSMA(priceNum, 50) || getDefaultSMA50(stock.query),
      volume: stock.priceInfo?.volume || getDefaultVolume(stock.query),
      volatility:
        calculateVolatility(changePct) || getDefaultVolatility(stock.query),
    },
    investmentStyles,
    risks: detailedRisks,
    opportunities: detailedOpportunities,
    aiSummary,
    analysisDate: new Date().toISOString(),
  };
}

function parseCompanyOverviewText(text: string): {
  industry?: string;
  sector?: string;
  founded?: string;
  employees?: number;
  headquarters?: string;
  website?: string;
} {
  const get = (re: RegExp) => {
    const m = text.match(re);
    return m ? m[1].trim() : undefined;
  };

  // 従業員数の解析（より柔軟なパターン）
  const employeesRaw = get(
    /(?:従業員(?:数|規模)?|社員(?:数|規模)?|人員|Employees|Headcount|Staff)[:：]?\s*([\d,]+)\s*人?/i
  );
  const employees = employeesRaw
    ? parseInt(employeesRaw.replace(/,/g, ""), 10)
    : undefined;

  // より柔軟な正規表現パターン
  const patterns = {
    industry: [
      /(?:業種|Industry)[:：]\s*([^\n，、。]+)/i,
      /(?:事業内容|Business)[:：]\s*([^\n，、。]+)/i,
      /(?:主要事業|Main Business)[:：]\s*([^\n，、。]+)/i,
    ],
    sector: [
      /(?:セクター|Sector)[:：]\s*([^\n，、。]+)/i,
      /(?:業界|Industry Sector)[:：]\s*([^\n，、。]+)/i,
    ],
    founded: [
      /(?:設立|設立年|創業|Founded)[:：]?\s*([^\n]+)/i,
      /(?:創立|創立年|Established)[:：]?\s*([^\n]+)/i,
    ],
    headquarters: [
      /(?:本社|Headquarters)[:：]\s*([^\n]+)/i,
      /(?:所在地|Location)[:：]\s*([^\n]+)/i,
      /(?:本社所在地|Head Office)[:：]\s*([^\n]+)/i,
    ],
    website: [
      /(?:公式サイト|ウェブサイト|Website)[:：]\s*(https?:\/\/\S+)/i,
      /(?:URL|Web)[:：]\s*(https?:\/\/\S+)/i,
    ],
  };

  const result: any = {};

  // 各項目について複数のパターンを試行
  Object.entries(patterns).forEach(([key, patternList]) => {
    for (const pattern of patternList) {
      const value = get(pattern);
      if (value && value.length > 0) {
        result[key] = value;
        break;
      }
    }
  });

  // 従業員数を追加
  if (employees) {
    result.employees = employees;
  }

  // デバッグ用ログ
  console.log("企業概要解析結果:", {
    inputText: text.substring(0, 200) + "...",
    parsedResult: result,
  });

  return result;
}

function parseFinancialMetrics(text: string): {
  per?: number;
  pbr?: number;
  roe?: number;
  dividend?: number;
  dividendYield?: number;
  revenueGrowth?: number;
  marketCap?: number;
  eps?: number;
  bps?: number;
} {
  const flexibleNum = (re: RegExp) => {
    const m = text.match(re);
    if (!m) return undefined;
    const cleaned = m[1]
      .replace(/\([^)]*\)/g, "")
      .replace(/,/g, "")
      .replace(/[^\d.-]/g, "");
    const v = parseFloat(cleaned);
    return Number.isFinite(v) ? v : undefined;
  };

  // より柔軟な正規表現パターン（実際のPerplexityレスポンスに合わせて調整）
  const patterns = {
    per: [
      /\bPER\b[:：]?\s*([\d.,()%-]+)/i,
      /(?:株価収益率|Price-to-Earnings|P\/E)[:：]?\s*([\d.,()%-]+)/i,
      /(?:株価収益倍率|Price Earnings Ratio)[:：]?\s*([\d.,()%-]+)/i,
      /(?:PER|P\/E)[:：]?\s*([\d.,()%-]+)/i,
      /PER\s*([\d.,()%-]+)/i,
      /P\/E\s*([\d.,()%-]+)/i,
    ],
    pbr: [
      /\bPBR\b[:：]?\s*([\d.,()%-]+)/i,
      /(?:株価純資産倍率|Price-to-Book|P\/B)[:：]?\s*([\d.,()%-]+)/i,
      /(?:株価純資産比率|Price Book Ratio)[:：]?\s*([\d.,()%-]+)/i,
      /(?:PBR|P\/B)[:：]?\s*([\d.,()%-]+)/i,
      /PBR\s*([\d.,()%-]+)/i,
      /P\/B\s*([\d.,()%-]+)/i,
    ],
    roe: [
      /\bROE\b[:：]?\s*([\d.,()%-]+)/i,
      /(?:自己資本利益率|Return on Equity)[:：]?\s*([\d.,()%-]+)/i,
      /(?:株主資本利益率|Return on Shareholders' Equity)[:：]?\s*([\d.,()%-]+)/i,
      /ROE\s*([\d.,()%-]+)/i,
    ],
    dividend: [
      /(?:配当(?:金|額)?|Dividend)[:：]?\s*([\d.,()%-]+)/i,
      /(?:年間配当|Annual Dividend)[:：]?\s*([\d.,()%-]+)/i,
      /配当\s*([\d.,()%-]+)/i,
    ],
    dividendYield: [
      /(?:配当利回り|Dividend\s*Yield)[:：]?\s*([\d.,()%-]+)/i,
      /(?:配当収益率|Dividend Return)[:：]?\s*([\d.,()%-]+)/i,
      /配当利回り\s*([\d.,()%-]+)/i,
    ],
    revenueGrowth: [
      /(?:売上(?:高)?成長(?:率)?|Revenue\s*Growth)[:：]?\s*([+-]?[\d.,()%-]+)/i,
      /(?:売上増加率|Sales Growth)[:：]?\s*([+-]?[\d.,()%-]+)/i,
      /売上成長率\s*([+-]?[\d.,()%-]+)/i,
    ],
    marketCap: [
      /(?:時価総額|Market\s*Cap)[:：]?\s*([\d.,()%-]+)/i,
      /(?:市場価値|Market Value)[:：]?\s*([\d.,()%-]+)/i,
      /時価総額\s*([\d.,()%-]+)/i,
    ],
    eps: [
      /\bEPS\b[:：]?\s*([\d.,()%-]+)/i,
      /(?:1株当たり利益|Earnings per Share)[:：]?\s*([\d.,()%-]+)/i,
      /(?:株当たり利益|Per Share Earnings)[:：]?\s*([\d.,()%-]+)/i,
      /EPS\s*([\d.,()%-]+)/i,
    ],
    bps: [
      /\bBPS\b[:：]?\s*([\d.,()%-]+)/i,
      /(?:1株当たり純資産|Book Value per Share)[:：]?\s*([\d.,()%-]+)/i,
      /(?:株当たり純資産|Per Share Book Value)[:：]?\s*([\d.,()%-]+)/i,
      /BPS\s*([\d.,()%-]+)/i,
    ],
  };

  const result: any = {};

  // 各指標について複数のパターンを試行
  Object.entries(patterns).forEach(([key, patternList]) => {
    for (const pattern of patternList) {
      const value = flexibleNum(pattern);
      if (value !== undefined) {
        result[key] = value;
        break;
      }
    }
  });

  // デバッグ用ログ
  console.log("財務データ解析結果:", {
    inputText: text.substring(0, 200) + "...",
    parsedResult: result,
  });

  return result;
}

// 投資スタイル傾向の計算
function calculateInvestmentStyles(
  fm: ReturnType<typeof parseFinancialMetrics>,
  overviewText: string,
  newsText: string
): {
  growth: number;
  value: number;
  dividend: number;
  momentum: number;
  quality: number;
} {
  // グロース（成長性）の計算
  const growthScore = (() => {
    let score = 0;
    if (fm.revenueGrowth && fm.revenueGrowth > 10) score += 3;
    else if (fm.revenueGrowth && fm.revenueGrowth > 5) score += 2;
    else if (fm.revenueGrowth && fm.revenueGrowth > 0) score += 1;

    if (fm.roe && fm.roe > 15) score += 2;
    else if (fm.roe && fm.roe > 10) score += 1;

    if (overviewText.includes("成長") || overviewText.includes("拡大"))
      score += 1;
    if (newsText.includes("成長") || newsText.includes("拡大")) score += 1;

    return Math.min(5, Math.max(0, score));
  })();

  // バリュー（割安性）の計算
  const valueScore = (() => {
    let score = 0;
    if (fm.per && fm.per < 15) score += 3;
    else if (fm.per && fm.per < 20) score += 2;
    else if (fm.per && fm.per < 25) score += 1;

    if (fm.pbr && fm.pbr < 1.5) score += 2;
    else if (fm.pbr && fm.pbr < 2.0) score += 1;

    return Math.min(5, Math.max(0, score));
  })();

  // 配当（配当性向）の計算
  const dividendScore = (() => {
    let score = 0;
    if (fm.dividendYield && fm.dividendYield > 3) score += 3;
    else if (fm.dividendYield && fm.dividendYield > 2) score += 2;
    else if (fm.dividendYield && fm.dividendYield > 1) score += 1;

    if (fm.dividend && fm.dividend > 0) score += 1;

    return Math.min(5, Math.max(0, score));
  })();

  // モメンタム（勢い）の計算
  const momentumScore = (() => {
    let score = 0;
    if (fm.roe && fm.roe > 20) score += 2;
    else if (fm.roe && fm.roe > 15) score += 1;

    if (newsText.includes("上昇") || newsText.includes("好調")) score += 2;
    if (newsText.includes("成長") || newsText.includes("拡大")) score += 1;

    return Math.min(5, Math.max(0, score));
  })();

  // クオリティ（品質）の計算
  const qualityScore = (() => {
    let score = 0;
    if (fm.roe && fm.roe > 15) score += 2;
    else if (fm.roe && fm.roe > 10) score += 1;

    if (fm.per && fm.per > 0 && fm.per < 30) score += 1;
    if (fm.pbr && fm.pbr > 0 && fm.pbr < 3) score += 1;

    if (overviewText.includes("リーダー") || overviewText.includes("大手"))
      score += 1;

    return Math.min(5, Math.max(0, score));
  })();

  return {
    growth: growthScore,
    value: valueScore,
    dividend: dividendScore,
    momentum: momentumScore,
    quality: qualityScore,
  };
}

// リスクと機会の詳細化
function generateDetailedRisksAndOpportunities(
  swotAnalysis: any,
  overviewText: string,
  newsText: string,
  fm: ReturnType<typeof parseFinancialMetrics>
): {
  detailedRisks: string[];
  detailedOpportunities: string[];
} {
  const risks: string[] = [];
  const opportunities: string[] = [];

  // SWOT分析から抽出
  if (swotAnalysis?.weaknesses) {
    risks.push(...swotAnalysis.weaknesses.slice(0, 3));
  }
  if (swotAnalysis?.threats) {
    risks.push(...swotAnalysis.threats.slice(0, 3));
  }
  if (swotAnalysis?.opportunities) {
    opportunities.push(...swotAnalysis.opportunities.slice(0, 3));
  }
  if (swotAnalysis?.strengths) {
    opportunities.push(...swotAnalysis.strengths.slice(0, 2));
  }

  // 財務指標からリスクを追加
  if (fm.per && fm.per > 30) {
    risks.push("高PERによるバリュエーションリスク");
  }
  if (fm.pbr && fm.pbr > 3) {
    risks.push("高PBRによる資産価値リスク");
  }
  if (fm.revenueGrowth && fm.revenueGrowth < 0) {
    risks.push("売上減少による成長性リスク");
  }

  // 財務指標から機会を追加
  if (fm.roe && fm.roe > 15) {
    opportunities.push("高いROEによる収益性の優位性");
  }
  if (fm.revenueGrowth && fm.revenueGrowth > 10) {
    opportunities.push("高い成長率による将来性");
  }
  if (fm.dividendYield && fm.dividendYield > 2) {
    opportunities.push("安定した配当による収益性");
  }

  // テキスト分析から追加
  if (newsText.includes("競合") || newsText.includes("競争")) {
    risks.push("競合激化による市場シェアリスク");
  }
  if (newsText.includes("規制") || newsText.includes("法規制")) {
    risks.push("規制環境の変化による事業リスク");
  }
  if (newsText.includes("AI") || newsText.includes("人工知能")) {
    opportunities.push("AI技術活用による新たな成長機会");
  }
  if (newsText.includes("海外") || newsText.includes("国際")) {
    opportunities.push("海外市場拡大による成長機会");
  }

  // デフォルト値を設定
  if (risks.length === 0) {
    risks.push("市場変動リスク", "競合激化リスク", "規制変更リスク");
  }
  if (opportunities.length === 0) {
    opportunities.push("事業拡大機会", "技術革新機会", "市場成長機会");
  }

  return {
    detailedRisks: risks.slice(0, 6),
    detailedOpportunities: opportunities.slice(0, 6),
  };
}

// 市場センチメントの詳細化
function generateMarketSentiment(
  newsText: string,
  technicalIndicators: any,
  fm: ReturnType<typeof parseFinancialMetrics>
): {
  sentiment: "bullish" | "neutral" | "bearish";
  newsScore: number;
  analystRating: number;
  socialMention: number;
  institutionalFlow: number;
} {
  // ニューススコアの計算
  const newsScore = (() => {
    let score = 0;
    const positiveWords = [
      "好調",
      "成長",
      "上昇",
      "拡大",
      "成功",
      "好業績",
      "増収",
      "増益",
    ];
    const negativeWords = [
      "悪化",
      "減少",
      "下落",
      "縮小",
      "失敗",
      "減収",
      "減益",
      "懸念",
    ];

    positiveWords.forEach(word => {
      if (newsText.includes(word)) score += 2;
    });
    negativeWords.forEach(word => {
      if (newsText.includes(word)) score -= 2;
    });

    return Math.min(100, Math.max(0, 50 + score));
  })();

  // アナリスト評価の計算
  const analystRating = (() => {
    let rating = 2.5; // デフォルトは中立

    if (fm.roe && fm.roe > 15) rating += 1;
    if (fm.per && fm.per > 0 && fm.per < 20) rating += 0.5;
    if (fm.revenueGrowth && fm.revenueGrowth > 10) rating += 1;

    if (newsText.includes("推奨") || newsText.includes("買い")) rating += 0.5;
    if (newsText.includes("売り") || newsText.includes("回避")) rating -= 0.5;

    return Math.min(5, Math.max(0, rating));
  })();

  // SNS言及の計算
  const socialMention = (() => {
    let mention = 30; // ベースライン

    if (newsText.includes("話題") || newsText.includes("注目")) mention += 20;
    if (newsText.includes("AI") || newsText.includes("テクノロジー"))
      mention += 15;
    if (newsText.includes("環境") || newsText.includes("ESG")) mention += 10;

    return Math.min(100, mention);
  })();

  // 機関フローの計算
  const institutionalFlow = (() => {
    let flow = 40; // ベースライン

    if (fm.marketCap && fm.marketCap > 1000000000000) flow += 20; // 大企業
    if (fm.roe && fm.roe > 15) flow += 15;
    if (fm.dividendYield && fm.dividendYield > 2) flow += 10;

    return Math.min(100, flow);
  })();

  // センチメントの決定
  const sentiment = (() => {
    const avgScore =
      (newsScore + analystRating * 20 + socialMention + institutionalFlow) / 4;
    if (avgScore > 60) return "bullish" as const;
    if (avgScore < 40) return "bearish" as const;
    return "neutral" as const;
  })();

  return {
    sentiment,
    newsScore,
    analystRating,
    socialMention,
    institutionalFlow,
  };
}

// 財務健全性の詳細化
function generateFinancialHealth(
  fm: ReturnType<typeof parseFinancialMetrics>,
  overviewText: string
): {
  profitability: number;
  stability: number;
  growth: number;
  efficiency: number;
  liquidity: number;
} {
  // D/E比率の推定
  const debtToEquity = (() => {
    if (fm.pbr && fm.pbr > 0) {
      // PBRから推定（簡易計算）
      return Math.max(0, Math.min(200, (fm.pbr - 1) * 50));
    }
    return 30; // デフォルト値
  })();

  // 流動比率の推定
  const currentRatio = (() => {
    if (fm.per && fm.per > 0) {
      // PERから推定（簡易計算）
      return Math.max(100, Math.min(300, 200 - (fm.per - 15) * 5));
    }
    return 150; // デフォルト値
  })();

  // キャッシュフローの推定
  const cashFlow = (() => {
    if (fm.roe && fm.roe > 0) {
      return Math.max(0, Math.min(100, fm.roe * 2));
    }
    return 50; // デフォルト値
  })();

  // インタレストカバレッジの推定
  const interestCoverage = (() => {
    if (fm.roe && fm.roe > 0) {
      return Math.max(0, Math.min(50, fm.roe * 1.5));
    }
    return 10; // デフォルト値
  })();

  return {
    profitability: Math.min(100, Math.max(0, (fm.roe || 10) * 10)), // ROEベース
    stability: Math.min(100, Math.max(0, 100 - debtToEquity)), // D/Eの逆数
    growth: Math.min(100, Math.max(0, (fm.revenueGrowth || 5) * 10)), // 売上成長率ベース
    efficiency: Math.min(100, Math.max(0, cashFlow)), // キャッシュフローベース
    liquidity: Math.min(100, Math.max(0, currentRatio / 3)), // 流動比率ベース
  };
}

// 競合比較の詳細化
function generateEnhancedCompetitors(
  competitors: Array<{ name: string; score: number; change: number }>,
  competitorText: string,
  stockQuery: string
): Array<{ name: string; score: number; change: number }> {
  if (competitors.length > 0) {
    return competitors;
  }

  // デフォルトの競合を生成
  const defaultCompetitors = (() => {
    const isJapanese = /^\d{4}$/.test(stockQuery);

    if (isJapanese) {
      // 日本株の場合
      return [
        { name: "トヨタ自動車", score: 8.5, change: 2.3 },
        { name: "ソニーグループ", score: 7.8, change: -1.2 },
        { name: "ソフトバンクグループ", score: 6.2, change: 0.8 },
      ];
    } else {
      // 米国株の場合
      return [
        { name: "Apple Inc.", score: 9.1, change: 1.5 },
        { name: "Microsoft Corp.", score: 8.7, change: 2.1 },
        { name: "Google (Alphabet)", score: 8.3, change: -0.5 },
      ];
    }
  })();

  return defaultCompetitors;
}

// テクニカル指標の計算関数
function calculateRSI(price: number, changePercent: number): number {
  if (!price || !changePercent) return 50; // デフォルト値

  // 簡易RSI計算（実際のRSI計算は複雑ですが、ここでは簡易版）
  const normalizedChange = Math.abs(changePercent);
  if (normalizedChange > 5) return changePercent > 0 ? 70 : 30;
  if (normalizedChange > 2) return changePercent > 0 ? 60 : 40;
  return 50;
}

function calculateSMA(price: number, period: number): number {
  if (!price) return 0;

  // 簡易SMA計算（実際のSMA計算は複雑ですが、ここでは簡易版）
  const variation = period === 20 ? 0.95 : 0.9; // 20日線は現在価格の95%、50日線は90%
  return Math.round(price * variation);
}

function calculateVolatility(changePercent: number): number {
  if (!changePercent) return 0;

  // 簡易ボラティリティ計算
  const absChange = Math.abs(changePercent);
  if (absChange > 5) return 25;
  if (absChange > 3) return 20;
  if (absChange > 1) return 15;
  return 10;
}

// デフォルト値の取得関数
function getDefaultPER(query: string): number {
  const defaults: { [key: string]: number } = {
    AMZN: 35.5,
    AAPL: 28.2,
    GOOGL: 25.8,
    MSFT: 32.1,
    TSLA: 45.3,
    "6501": 12.5, // 日立製作所
    "6758": 15.2, // ソニー
    "7203": 8.9, // トヨタ
  };
  return defaults[query] || 0;
}

function getDefaultPBR(query: string): number {
  const defaults: { [key: string]: number } = {
    AMZN: 7.4,
    AAPL: 5.2,
    GOOGL: 4.8,
    MSFT: 6.1,
    TSLA: 8.9,
    "6501": 1.2,
    "6758": 2.1,
    "7203": 0.8,
  };
  return defaults[query] || 0;
}

function getDefaultROE(query: string): number {
  const defaults: { [key: string]: number } = {
    AMZN: 15.2,
    AAPL: 18.5,
    GOOGL: 16.8,
    MSFT: 19.2,
    TSLA: 12.3,
    "6501": 8.5,
    "6758": 12.1,
    "7203": 6.8,
  };
  return defaults[query] || 0;
}

function getDefaultEPS(query: string): number {
  const defaults: { [key: string]: number } = {
    AMZN: 2.8,
    AAPL: 6.1,
    GOOGL: 4.8,
    MSFT: 9.2,
    TSLA: 3.2,
    "6501": 450,
    "6758": 680,
    "7203": 1200,
  };
  return defaults[query] || 0;
}

function getDefaultBPS(query: string): number {
  const defaults: { [key: string]: number } = {
    AMZN: 45.2,
    AAPL: 32.8,
    GOOGL: 28.5,
    MSFT: 35.1,
    TSLA: 36.2,
    "6501": 3800,
    "6758": 3200,
    "7203": 15000,
  };
  return defaults[query] || 0;
}

function getDefaultMarketCap(query: string): number {
  const defaults: { [key: string]: number } = {
    AMZN: 1500000000000,
    AAPL: 2800000000000,
    GOOGL: 1700000000000,
    MSFT: 2500000000000,
    TSLA: 800000000000,
    "6501": 8000000000000,
    "6758": 12000000000000,
    "7203": 25000000000000,
  };
  return defaults[query] || 0;
}

function getDefaultRevenueGrowth(query: string): number {
  const defaults: { [key: string]: number } = {
    AMZN: 12.5,
    AAPL: 8.2,
    GOOGL: 15.8,
    MSFT: 11.2,
    TSLA: 25.3,
    "6501": 5.8,
    "6758": 8.9,
    "7203": 3.2,
  };
  return defaults[query] || 0;
}

function getDefaultSMA20(query: string): number {
  const defaults: { [key: string]: number } = {
    AMZN: 220,
    AAPL: 180,
    GOOGL: 140,
    MSFT: 380,
    TSLA: 250,
    "6501": 8500,
    "6758": 12000,
    "7203": 2800,
  };
  return defaults[query] || 0;
}

function getDefaultSMA50(query: string): number {
  const defaults: { [key: string]: number } = {
    AMZN: 208,
    AAPL: 175,
    GOOGL: 135,
    MSFT: 370,
    TSLA: 240,
    "6501": 8200,
    "6758": 11500,
    "7203": 2700,
  };
  return defaults[query] || 0;
}

function getDefaultVolume(query: string): string {
  const defaults: { [key: string]: string } = {
    AMZN: "45.2M",
    AAPL: "52.8M",
    GOOGL: "28.5M",
    MSFT: "35.1M",
    TSLA: "89.2M",
    "6501": "2.8M",
    "6758": "1.5M",
    "7203": "8.2M",
  };
  return defaults[query] || "-";
}

function getDefaultVolatility(query: string): number {
  const defaults: { [key: string]: number } = {
    AMZN: 15,
    AAPL: 12,
    GOOGL: 18,
    MSFT: 14,
    TSLA: 35,
    "6501": 8,
    "6758": 12,
    "7203": 6,
  };
  return defaults[query] || 0;
}

function parseNewsScore(text: string): number {
  if (!text) return 0;
  const urlCount = (text.match(/https?:\/\//g) || []).length;
  const bullets = (text.match(/^\s*(?:[-*・]|\d+\.)\s+/gm) || []).length;
  const lines = text.split(/\n/).filter(l => l.trim().length > 0).length || 0;
  const base =
    urlCount * 20 + bullets * 10 + Math.min(10, Math.floor(lines / 3)) * 2;
  return Math.max(0, Math.min(100, base));
}

function parseSentimentFromNews(
  text: string
): "bullish" | "neutral" | "bearish" {
  if (!text) return "neutral";
  const positive = [
    "上昇",
    "好調",
    "増収",
    "増益",
    "最高",
    "回復",
    "買い",
    "強気",
    "上方修正",
    "beat",
    "upgrade",
    "outperform",
    "surge",
    "rally",
  ];
  const negative = [
    "下落",
    "不調",
    "減収",
    "減益",
    "悪化",
    "赤字",
    "警告",
    "弱気",
    "下方修正",
    "miss",
    "downgrade",
    "underperform",
    "sell-off",
    "slump",
  ];
  let posScore = 0;
  let negScore = 0;
  positive.forEach(k => {
    const c = (text.match(new RegExp(k, "gi")) || []).length;
    posScore += c * 2;
  });
  negative.forEach(k => {
    const c = (text.match(new RegExp(k, "gi")) || []).length;
    negScore += c * 2;
  });
  const urlCount = (text.match(/https?:\/\//g) || []).length;
  const urlWeight = Math.min(3, urlCount);
  const lines = text.split("\n").filter(l => l.trim().length > 0);
  const early = lines
    .slice(0, Math.min(3, lines.length))
    .join(" ")
    .toLowerCase();
  const earlyPos = positive.filter(k => early.includes(k.toLowerCase())).length;
  const earlyNeg = negative.filter(k => early.includes(k.toLowerCase())).length;
  posScore += earlyPos * 3;
  negScore += earlyNeg * 3;
  const finalPos = posScore * (1 + urlWeight * 0.2);
  const finalNeg = negScore * (1 + urlWeight * 0.2);
  if (finalPos > finalNeg && finalPos > 2) return "bullish";
  if (finalNeg > finalPos && finalNeg > 2) return "bearish";
  return "neutral";
}

function parseCompetitors(
  text: string,
  selfCode: string
): { name: string; score: number; change: number }[] {
  if (!text) return [];
  const candidates: string[] = [];
  const bulletLines = text.match(/^\s*(?:[-*・]|\d+\.)\s+(.+)$/gm) || [];
  for (const line of bulletLines) {
    const m = line.replace(/^\s*(?:[-*・]|\d+\.)\s+/, "");
    m.split(/[、,\/]|\s{2,}/).forEach(tok => {
      const t = tok.trim();
      if (t.length >= 2) candidates.push(t);
    });
  }
  const near = text.match(/(競合|ライバル)[^\n]*?[:：]?\s*(.+)/g) || [];
  for (const seg of near) {
    seg
      .replace(/.*?[:：]\s*/, "")
      .split(/[、,\/]/)
      .forEach(tok => {
        const t = tok.trim();
        if (t.length >= 2) candidates.push(t);
      });
  }
  const self = selfCode.toUpperCase();
  const unique: string[] = [];
  for (const c of candidates) {
    const clean = c
      .replace(/^[\-–—\s]+/, "")
      .replace(/[ (（【].*?[)）】]/g, "")
      .replace(/[「」『』""'']/g, "")
      .replace(/[：:]\s*$/, "")
      .trim();
    if (!clean) continue;
    if (clean.toUpperCase().includes(self)) continue;
    if (
      /^(競合|主要|他|同業|ライバル|代表|有力|大手|上位|注目|重要|主要な|その他|など|等|etc)/.test(
        clean
      )
    )
      continue;
    if (/^[\d\s\-_.,()]+$/.test(clean)) continue;
    if (clean.length < 2) continue;
    if (!unique.includes(clean)) unique.push(clean);
    if (unique.length >= 3) break;
  }
  const baseScores = [10, 8, 6];
  return unique.map((name, i) => ({
    name,
    score: baseScores[i] || 6,
    change: 0,
  }));
}
