import axios from "axios";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export interface AnalysisResult {
  investmentAdvice: string;
  targetPrice: {
    shortTerm: number;
    mediumTerm: number;
    longTerm: number;
  };
  stopLoss: {
    shortTerm: number;
    mediumTerm: number;
    longTerm: number;
  };
  riskLevel: "low" | "medium" | "high";
  confidence: number;
  keyFactors: string[];
  recommendations: string[];
  swot?: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  aiReflection?: string; // AIの感想・考察
}

export interface NewsAnalysisResult {
  impact: "positive" | "negative" | "neutral";
  impactScore: number; // -100 to 100
  analysis: string;
  keyPoints: string[];
  recommendations: string[];
}

export interface FinancialEvaluationResult {
  bs: { score: 1 | 2 | 3 | 4 | 5; summary: string };
  pl: { score: 1 | 2 | 3 | 4 | 5; summary: string };
  cf: { score: 1 | 2 | 3 | 4 | 5; summary: string };
  overall: { score: 1 | 2 | 3 | 4 | 5; label: string };
  analysis: string;
  recommendations: string[];
}

export interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterClient {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseURL = OPENROUTER_BASE_URL;
  }

  async analyzeStock(
    companyInfo: any,
    stockData: any,
    newsData: any[],
    edinetExtras?: {
      ratios?: any;
      financialHistory?: any[];
      accountingStandard?: string | null;
    }
  ): Promise<AnalysisResult> {
    try {
      const prompt = this.buildAnalysisPrompt(companyInfo, stockData, newsData, edinetExtras);

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: "anthropic/claude-3.5-sonnet", // コスト効率の良いモデル
          messages: [
            {
              role: "system",
              content: `あなたは経験豊富な証券アナリストです。企業の財務データ、株価情報、最新ニュースを基に、投資判断をサポートする分析を行ってください。回答はJSON形式で返してください。`,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 2500,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://kabu-ana.com",
            "X-Title": "AI Market Analyzer",
          },
          timeout: 30000,
        }
      );

      const data: OpenRouterResponse = response.data;
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error("AI分析結果が取得できませんでした");
      }

      const analysisResult = this.parseAnalysisResult(content);

      // AI感想を生成
      const reflection = await this.generateReflection(
        companyInfo,
        stockData,
        newsData
      );
      analysisResult.aiReflection = reflection;

      return analysisResult;
    } catch (error: any) {
      console.error("OpenRouter分析エラー:", error);
      // OpenRouter APIからのエラーレスポンスを解析してわかりやすいメッセージにする
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data;
        const apiMessage = data?.error?.message || data?.message;
        if (status === 401) {
          throw new Error("AI分析サービスの認証に失敗しました。APIキーを確認してください。");
        }
        if (status === 402) {
          throw new Error("AI分析サービスの残高が不足しています。");
        }
        if (status === 429) {
          throw new Error("AI分析サービスのリクエスト制限に達しました。しばらくしてから再試行してください。");
        }
        if (status === 404 || (apiMessage && apiMessage.includes("model"))) {
          throw new Error("AI分析モデルが利用できません。管理者にお問い合わせください。");
        }
        if (error.code === "ECONNABORTED") {
          throw new Error("AI分析がタイムアウトしました。しばらくしてから再試行してください。");
        }
        throw new Error(apiMessage || "AI分析中にエラーが発生しました。");
      }
      throw error;
    }
  }

  private buildAnalysisPrompt(
    companyInfo: any,
    stockData: any,
    newsData: any[],
    edinetExtras?: { ratios?: any; financialHistory?: any[]; accountingStandard?: string | null }
  ): string {
    const ratios = edinetExtras?.ratios;
    const history = edinetExtras?.financialHistory;
    const acctStd = edinetExtras?.accountingStandard;

    const ratiosSection = ratios ? `
【財務指標（EDINET DB）】
- 会計基準: ${acctStd || "N/A"}
- ROE: ${ratios.roe != null ? (ratios.roe * 100).toFixed(1) + "%" : "N/A"}
- ROA: ${ratios.roa != null ? (ratios.roa * 100).toFixed(1) + "%" : "N/A"}
- 営業利益率: ${ratios.operatingMargin != null ? (ratios.operatingMargin * 100).toFixed(1) + "%" : "N/A"}
- 純利益率: ${ratios.netMargin != null ? (ratios.netMargin * 100).toFixed(1) + "%" : "N/A"}
- 自己資本比率: ${ratios.equityRatio != null ? (ratios.equityRatio * 100).toFixed(1) + "%" : "N/A"}
- 流動比率: ${ratios.currentRatio != null ? (ratios.currentRatio * 100).toFixed(1) + "%" : "N/A"}
- FCF: ${ratios.fcf != null ? ratios.fcf.toLocaleString() : "N/A"}
- EBITDA: ${ratios.ebitda != null ? ratios.ebitda.toLocaleString() : "N/A"}
- 売上成長率(YoY): ${ratios.revenueGrowth != null ? (ratios.revenueGrowth * 100).toFixed(1) + "%" : "N/A"}
- 純利益成長率(YoY): ${ratios.niGrowth != null ? (ratios.niGrowth * 100).toFixed(1) + "%" : "N/A"}
- 売上CAGR(3年): ${ratios.revenueCagr3y != null ? (ratios.revenueCagr3y * 100).toFixed(1) + "%" : "N/A"}
- 配当利回り: ${ratios.dividendYield != null ? (ratios.dividendYield * 100).toFixed(1) + "%" : "N/A"}` : "";

    const historySection = history && history.length > 0 ? `
【財務推移（EDINET DB・直近${history.length}年）】
${history.map(h => `- FY${h.fiscalYear}: 売上高=${h.revenue ? (h.revenue / 1e8).toFixed(1) + "億" : "N/A"}, 営業利益=${h.operatingIncome ? (h.operatingIncome / 1e8).toFixed(1) + "億" : "N/A"}, 純利益=${h.netIncome ? (h.netIncome / 1e8).toFixed(1) + "億" : "N/A"}`).join("\n")}` : "";

    return `
以下の企業情報を基に、投資分析を行ってください。

【企業情報】
- 企業名: ${companyInfo?.name || "N/A"}
- シンボル: ${companyInfo?.symbol || "N/A"}
- 市場: ${companyInfo?.market || "N/A"}
- 現在価格: ${stockData?.price || "N/A"}
- 変動: ${stockData?.change || "N/A"} (${stockData?.changePercent || "N/A"}%)
- 時価総額: ${stockData?.marketCap || "N/A"}
- PER: ${stockData?.pe || "N/A"}
- EPS: ${stockData?.eps || "N/A"}
- 配当: ${stockData?.dividend || "N/A"}
${ratiosSection}
${historySection}

【最新ニュース】
${newsData.map(news => `- ${news.title}: ${news.snippet}`).join("\n")}

以下のJSON形式で分析結果を返してください：
{
  "investmentAdvice": "投資判断の総合的なアドバイス",
  "targetPrice": {
    "shortTerm": 短期目標価格,
    "mediumTerm": 中期目標価格,
    "longTerm": 長期目標価格
  },
  "stopLoss": {
    "shortTerm": 短期損切りライン,
    "mediumTerm": 中期損切りライン,
    "longTerm": 長期損切りライン
  },
  "riskLevel": "low|medium|high",
  "confidence": 信頼度(0-100),
  "keyFactors": ["重要な要因1", "重要な要因2", "..."],
  "recommendations": ["推奨事項1", "推奨事項2", "..."],
  "swot": {
    "strengths": ["強み1", "強み2"],
    "weaknesses": ["弱み1", "弱み2"],
    "opportunities": ["機会1", "機会2"],
    "threats": ["脅威1", "脅威2"]
  }
}
    `.trim();
  }

  private async generateReflection(
    companyInfo: any,
    stockData: any,
    newsData: any[]
  ): Promise<string> {
    try {
      const reflectionPrompt = this.buildReflectionPrompt(
        companyInfo,
        stockData,
        newsData
      );

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: "anthropic/claude-3.5-sonnet",
          messages: [
            {
              role: "system",
              content: `あなたは経験豊富な投資家です。企業の情報を基に、個人的な感想や考察を自然な日本語で述べてください。分析とは違った角度から、直感的な印象や長期的な視点での考えを共有してください。`,
            },
            {
              role: "user",
              content: reflectionPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 800,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://kabu-ana.com",
            "X-Title": "AI Market Analyzer",
          },
          timeout: 30000,
        }
      );

      const data: OpenRouterResponse = response.data;
      const content = data.choices[0]?.message?.content;

      return content || "感想を生成できませんでした。";
    } catch (error) {
      console.error("AI感想生成エラー:", error);
      return "感想の生成中にエラーが発生しました。";
    }
  }

  private buildReflectionPrompt(
    companyInfo: any,
    stockData: any,
    newsData: any[]
  ): string {
    return `
以下の企業について、私ならこう考えるという観点から、自然な感想を述べてください。

【企業情報】
- 企業名: ${companyInfo?.name || "N/A"}
- シンボル: ${companyInfo?.symbol || "N/A"}
- 市場: ${companyInfo?.market || "N/A"}
- 現在価格: ${stockData?.price || "N/A"}
- 変動: ${stockData?.change || "N/A"} (${stockData?.changePercent || "N/A"}%)
- 時価総額: ${stockData?.marketCap || "N/A"}
- PER: ${stockData?.pe || "N/A"}
- EPS: ${stockData?.eps || "N/A"}
- 配当: ${stockData?.dividend || "N/A"}

【最新ニュース】
${newsData.map(news => `- ${news.title}: ${news.snippet}`).join("\n")}

以下の観点から、個人的な感想を述べてください：
- この企業の印象や直感
- 長期的な成長性への期待
- 投資家としての興味深い点
- 市場での位置づけや競争優位性
- 将来性やリスクへの個人的な見解

自然で親しみやすい日本語で、200-300文字程度で述べてください。
    `.trim();
  }

  private parseAnalysisResult(content: string): AnalysisResult {
    try {
      // JSON部分を抽出
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("JSON形式の分析結果が見つかりません");
      }

      const result = JSON.parse(jsonMatch[0]);

      return {
        investmentAdvice: result.investmentAdvice || "",
        targetPrice: {
          shortTerm: result.targetPrice?.shortTerm || 0,
          mediumTerm: result.targetPrice?.mediumTerm || 0,
          longTerm: result.targetPrice?.longTerm || 0,
        },
        stopLoss: {
          shortTerm: result.stopLoss?.shortTerm || 0,
          mediumTerm: result.stopLoss?.mediumTerm || 0,
          longTerm: result.stopLoss?.longTerm || 0,
        },
        riskLevel: result.riskLevel || "medium",
        confidence: result.confidence || 50,
        keyFactors: result.keyFactors || [],
        recommendations: result.recommendations || [],
        swot: result.swot || {
          strengths: [],
          weaknesses: [],
          opportunities: [],
          threats: [],
        },
      };
    } catch (error) {
      console.error("分析結果の解析エラー:", error);
      // フォールバック
      return {
        investmentAdvice: "分析結果の解析に失敗しました。",
        targetPrice: { shortTerm: 0, mediumTerm: 0, longTerm: 0 },
        stopLoss: { shortTerm: 0, mediumTerm: 0, longTerm: 0 },
        riskLevel: "medium",
        confidence: 0,
        keyFactors: [],
        recommendations: [],
        swot: {
          strengths: [],
          weaknesses: [],
          opportunities: [],
          threats: [],
        },
      };
    }
  }

  async analyzeNewsImpact(
    companyName: string,
    symbol: string,
    newsData: any[]
  ): Promise<NewsAnalysisResult> {
    try {
      const prompt = this.buildNewsAnalysisPrompt(
        companyName,
        symbol,
        newsData
      );

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: "anthropic/claude-3.5-sonnet",
          messages: [
            {
              role: "system",
              content: `あなたは経験豊富な株式アナリストです。最新のニュースを分析し、企業の株価に与える影響を評価してください。`,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://kabu-ana.com",
            "X-Title": "AI Market Analyzer",
          },
          timeout: 30000,
        }
      );

      const content = response.data.choices[0].message.content;
      const analysisResult = JSON.parse(content);

      return {
        impact: analysisResult.impact,
        impactScore: analysisResult.impactScore,
        analysis: analysisResult.analysis,
        keyPoints: analysisResult.keyPoints,
        recommendations: analysisResult.recommendations,
      };
    } catch (error: any) {
      console.error("ニュース分析エラー:", error);
      return {
        impact: "neutral",
        impactScore: 0,
        analysis: "ニュース分析中にエラーが発生しました。",
        keyPoints: [],
        recommendations: [],
      };
    }
  }

  private buildNewsAnalysisPrompt(
    companyName: string,
    symbol: string,
    newsData: any[]
  ): string {
    const newsText = newsData
      .map((news, index) => {
        return `${index + 1}. ${news.title || news.snippet || "タイトルなし"}
       概要: ${news.snippet || "概要なし"}
       ソース: ${news.source || "不明"}
       日付: ${news.date || "不明"}`;
      })
      .join("\n\n");

    return `
企業名: ${companyName}
証券コード: ${symbol}

以下の最新ニュースを分析し、この企業の株価に与える影響を評価してください：

${newsText}

以下のJSON形式で分析結果を返してください：
{
  "impact": "positive|negative|neutral",
  "impactScore": 数値(-100から100の間で、正の値は株価上昇要因、負の値は下落要因を示す),
  "analysis": "ニュースの総合的な分析と株価への影響の詳細説明",
  "keyPoints": ["重要なポイント1", "重要なポイント2", "..."],
  "recommendations": ["投資家への推奨事項1", "推奨事項2", "..."]
}
    `.trim();
  }

  async analyzeFinancials(
    companyName: string,
    symbol: string,
    financialData: any,
    edinetExtras?: {
      ratios?: any;
      financialHistory?: any[];
      accountingStandard?: string | null;
      edinetAnalysis?: any;
    }
  ) {
    try {
      const prompt = this.buildFinancialsPrompt(
        companyName,
        symbol,
        financialData,
        edinetExtras
      );
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: "anthropic/claude-3.5-sonnet",
          messages: [
            {
              role: "system",
              content:
                "あなたは熟練の財務アナリストです。BS/PL/CFを観点に、企業の財務健全性を5段階(1=弱い,5=強い)で評価し、日本語で簡潔に説明してください。必ず有効なJSONのみを返してください。",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 1200,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://kabu-ana.com",
            "X-Title": "AI Market Analyzer",
          },
          timeout: 30000,
        }
      );

      const content = response.data?.choices?.[0]?.message?.content as string;
      const json = JSON.parse(content);
      const toScore = (n: any) => {
        const v = Math.max(1, Math.min(5, Number(n) || 3));
        return Math.round(v) as 1 | 2 | 3 | 4 | 5;
      };
      return {
        bs: { score: toScore(json.bs?.score), summary: json.bs?.summary || "" },
        pl: { score: toScore(json.pl?.score), summary: json.pl?.summary || "" },
        cf: { score: toScore(json.cf?.score), summary: json.cf?.summary || "" },
        overall: {
          score: toScore(json.overall?.score),
          label: json.overall?.label || "総合評価",
        },
        analysis: json.analysis || "",
        recommendations: json.recommendations || [],
      };
    } catch (error) {
      console.error("財務評価エラー:", error);
      return {
        bs: { score: 3, summary: "BSの評価を取得できませんでした。" },
        pl: { score: 3, summary: "PLの評価を取得できませんでした。" },
        cf: { score: 3, summary: "CFの評価を取得できませんでした。" },
        overall: { score: 3, label: "総合評価" },
        analysis: "財務評価中にエラーが発生しました。",
        recommendations: [],
      };
    }
  }

  private buildFinancialsPrompt(
    companyName: string,
    symbol: string,
    financialData: any,
    edinetExtras?: {
      ratios?: any;
      financialHistory?: any[];
      accountingStandard?: string | null;
      edinetAnalysis?: any;
    }
  ) {
    const fd = financialData || {};
    const fmt = (v: any) => (v != null && v !== "" ? v : "データなし");

    const ratios = edinetExtras?.ratios;
    const history = edinetExtras?.financialHistory;
    const acctStd = edinetExtras?.accountingStandard;
    const ediAnalysis = edinetExtras?.edinetAnalysis;

    const ratiosSection = ratios ? `
【財務指標（EDINET DB・計算済み）】
- 会計基準: ${acctStd || "不明"}
- ROE: ${ratios.roe != null ? (ratios.roe * 100).toFixed(1) + "%" : "データなし"}
- ROA: ${ratios.roa != null ? (ratios.roa * 100).toFixed(1) + "%" : "データなし"}
- 営業利益率: ${ratios.operatingMargin != null ? (ratios.operatingMargin * 100).toFixed(1) + "%" : "データなし"}
- 純利益率: ${ratios.netMargin != null ? (ratios.netMargin * 100).toFixed(1) + "%" : "データなし"}
- 自己資本比率: ${ratios.equityRatio != null ? (ratios.equityRatio * 100).toFixed(1) + "%" : "データなし"}
- 流動比率: ${ratios.currentRatio != null ? (ratios.currentRatio * 100).toFixed(1) + "%" : "データなし"}
- D/Eレシオ: ${ratios.deRatio != null ? ratios.deRatio.toFixed(2) : "データなし"}
- FCF: ${ratios.fcf != null ? ratios.fcf.toLocaleString() : "データなし"}
- EBITDA: ${ratios.ebitda != null ? ratios.ebitda.toLocaleString() : "データなし"}
- 売上成長率(YoY): ${ratios.revenueGrowth != null ? (ratios.revenueGrowth * 100).toFixed(1) + "%" : "データなし"}
- 売上CAGR(3年): ${ratios.revenueCagr3y != null ? (ratios.revenueCagr3y * 100).toFixed(1) + "%" : "データなし"}` : "";

    const historySection = history && history.length > 0 ? `
【財務推移（EDINET DB・直近${history.length}年）】
${history.map(h => `- FY${h.fiscalYear}: 売上=${h.revenue ? (h.revenue / 1e8).toFixed(1) + "億" : "N/A"}, 営業利益=${h.operatingIncome ? (h.operatingIncome / 1e8).toFixed(1) + "億" : "N/A"}, 純利益=${h.netIncome ? (h.netIncome / 1e8).toFixed(1) + "億" : "N/A"}, 営業CF=${h.cfOperating ? (h.cfOperating / 1e8).toFixed(1) + "億" : "N/A"}`).join("\n")}` : "";

    const ediAnalysisSection = ediAnalysis?.credit_score != null ? `
【EDINET DB AIスコア】
- 財務健全性スコア: ${ediAnalysis.credit_score}
- 格付け: ${ediAnalysis.credit_rating || "N/A"}
- AI所見: ${ediAnalysis.summary || "N/A"}` : "";

    return `企業名: ${companyName}
シンボル: ${symbol}

以下の実際の財務データを基に、BS（貸借対照表）/PL（損益計算書）/CF（キャッシュフロー計算書）を5段階で評価してください。
データが「データなし」のものは、企業名・シンボルから公開情報を参照して評価してください。

【損益計算書（PL）】
- 売上高: ${fmt(fd.revenue)}
- 売上総利益: ${fmt(fd.grossProfit)}
- 売上総利益率: ${fmt(fd.grossProfitRatio)}
- 営業利益: ${fmt(fd.operatingIncome)}
- 営業利益率: ${fmt(fd.operatingIncomeRatio)}
- 当期純利益: ${fmt(fd.netIncome)}
- 純利益率: ${fmt(fd.netIncomeRatio)}
- EPS: ${fmt(fd.eps)}

【貸借対照表（BS）】
- 総資産: ${fmt(fd.totalAssets)}
- 総負債: ${fmt(fd.totalLiabilities)}
- 株主資本: ${fmt(fd.totalEquity)}
- 自己資本比率: ${fmt(fd.equityRatio)}
- 負債比率: ${fmt(fd.debtRatio)}
- 現金及び現金同等物: ${fmt(fd.cash)}

【キャッシュフロー計算書（CF）】
- 営業CF: ${fmt(fd.operatingCashFlow)}
- 投資CF: ${fmt(fd.investingCashFlow)}
- 財務CF: ${fmt(fd.financingCashFlow)}
- フリーCF: ${fmt(fd.freeCashFlow)}

決算期間: ${fmt(fd.period)}
${ratiosSection}
${historySection}
${ediAnalysisSection}

【出力フォーマット（必ずこのJSONのみを返す）】
{
  "bs": { "score": 1-5, "summary": "BSの要点(短文)" },
  "pl": { "score": 1-5, "summary": "PLの要点(短文)" },
  "cf": { "score": 1-5, "summary": "CFの要点(短文)" },
  "overall": { "score": 1-5, "label": "総合ラベル" },
  "analysis": "総合所見(2〜4文)",
  "recommendations": ["投資家への提言1", "提言2"]
}`;
  }
}
