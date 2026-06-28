import axios from "axios";
import { APP_NAME, APP_URL } from "../constants";
import { STRUCTURED_JSON_SENTINEL } from "./analysisStream";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export interface AnalysisResult {
  analysisConclusion: string;
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

export interface EdinetExtras {
  ratios?: any;
  financialHistory?: any[] | null;
  accountingStandard?: string | null;
}

function buildEdinetSections(edinetExtras?: EdinetExtras | null): string {
  const ratios = edinetExtras?.ratios;
  const history = edinetExtras?.financialHistory;
  const acctStd = edinetExtras?.accountingStandard;
  const pct = (v: number | undefined | null, d = 1) =>
    v != null ? (v * 100).toFixed(d) + "%" : "N/A";
  const oku = (v: number | undefined | null) =>
    v != null ? (v / 1e8).toFixed(1) + "億円" : "N/A";

  const ratiosSection = ratios
    ? `\n\n【財務指標（EDINET DB・公式有価証券報告書ベース）】
- 会計基準: ${acctStd || "N/A"}
- ROE: ${pct(ratios.roe)} / ROA: ${pct(ratios.roa)}
- 営業利益率: ${pct(ratios.operatingMargin)} / 純利益率: ${pct(ratios.netMargin)}
- 自己資本比率: ${pct(ratios.equityRatio)} / 流動比率: ${pct(ratios.currentRatio)}
- D/Eレシオ: ${ratios.deRatio != null ? ratios.deRatio.toFixed(2) : "N/A"}
- FCF: ${oku(ratios.fcf)} / EBITDA: ${oku(ratios.ebitda)}
- 売上成長率(YoY): ${pct(ratios.revenueGrowth)} / 純利益成長率(YoY): ${pct(ratios.niGrowth)}
- 売上CAGR(3年): ${pct(ratios.revenueCagr3y)} / 配当利回り: ${pct(ratios.dividendYield)}`
    : "";

  const historySection =
    history && history.length > 0
      ? `\n\n【財務推移（EDINET DB・直近${history.length}年）】\n${history
          .map(
            (h: any) =>
              `- FY${h.fiscalYear}: 売上=${oku(h.revenue)} / 営業利益=${oku(h.operatingIncome)} / 純利益=${oku(h.netIncome)} / 営業CF=${oku(h.cfOperating)}`
          )
          .join("\n")}`
      : "";

  return ratiosSection + historySection;
}

export function buildAnalysisPrompt(
  companyInfo: any,
  stockData: any,
  newsData: any[],
  streaming = false,
  edinetExtras?: EdinetExtras | null,
  question?: string
): string {
  const edinetSections = buildEdinetSections(edinetExtras);
  const questionSection = question ? `\n\n【質問】\n${question}` : "";
  const instruction = question
    ? "上記の質問に対して、企業データを参照しながら回答してください。投資助言は避け、分析・参考情報として整理してください。"
    : "以下の企業情報を基に、投資助言ではない参考分析を行ってください。売買判断を直接促す表現は避け、材料・リスク・確認ポイントとして整理してください。";

  const conclusionGuide =
    'analysisConclusion は「何をしている会社か」という会社紹介ではなく、提供データ（業績・利益率・成長率・株価材料・リスク）を踏まえた“分析の結論”を1〜2文で書いてください。次の3要素を必ず含めること: (1) 業績・収益性の見立て、(2) 株価の材料またはリスク、(3) 投資判断として次に注目すべき点。会社概要や一般論だけの文は禁止です。';

  const base = `
${instruction}

【企業情報】
- 企業名: ${companyInfo?.name || "N/A"}
- シンボル: ${companyInfo?.symbol || "N/A"}
- 市場: ${companyInfo?.market || "N/A"}
- 現在価格: ${stockData?.price || "N/A"}
- 変動: ${stockData?.change || "N/A"} (${stockData?.changePercent || "N/A"}%)
- 時価総額: ${stockData?.marketCap || "N/A"}
- PER: ${stockData?.pe || "N/A"}
- EPS: ${stockData?.eps || "N/A"}
- 配当: ${stockData?.dividend || "N/A"}${edinetSections}

【最新ニュース】
${newsData.map(news => `- ${news.title}: ${news.snippet}`).join("\n")}${questionSection}`;

  if (streaming) {
    return `${base}

まず、この企業について${question ? "質問への回答を" : "状況を"}200〜400字の自然文で述べてください。その後、改行を挟んで「${STRUCTURED_JSON_SENTINEL}」とだけ書き、その直後に以下のJSON形式で分析結果を返してください：

${conclusionGuide}
${STRUCTURED_JSON_SENTINEL}
{
  "analysisConclusion": "データに基づく1〜2文の分析の結論（業績の見立て・株価材料/リスク・次の注目点を含む）",
  "investmentAdvice": "参考情報としての総合コメント",
  "targetPrice": {
    "shortTerm": 短期目標価格,
    "mediumTerm": 中期目標価格,
    "longTerm": 長期目標価格
  },
  "stopLoss": {
    "shortTerm": 短期の下振れ目安,
    "mediumTerm": 中期の下振れ目安,
    "longTerm": 長期の下振れ目安
  },
  "riskLevel": "low|medium|high",
  "confidence": 信頼度(0-100),
  "keyFactors": ["重要な要因1", "重要な要因2", "..."],
  "recommendations": ["確認ポイント1", "確認ポイント2", "..."],
  "swot": {
    "strengths": ["強み1", "強み2"],
    "weaknesses": ["弱み1", "弱み2"],
    "opportunities": ["機会1", "機会2"],
    "threats": ["脅威1", "脅威2"]
  },
  "aiReflection": "200文字前後の自然な感想・考察"
}`.trim();
  }

  return `${base}

以下のJSON形式で分析結果を返してください：

${conclusionGuide}
{
  "analysisConclusion": "データに基づく1〜2文の分析の結論（業績の見立て・株価材料/リスク・次の注目点を含む）",
  "investmentAdvice": "参考情報としての総合コメント",
  "targetPrice": {
    "shortTerm": 短期目標価格,
    "mediumTerm": 中期目標価格,
    "longTerm": 長期目標価格
  },
  "stopLoss": {
    "shortTerm": 短期の下振れ目安,
    "mediumTerm": 中期の下振れ目安,
    "longTerm": 長期の下振れ目安
  },
  "riskLevel": "low|medium|high",
  "confidence": 信頼度(0-100),
  "keyFactors": ["重要な要因1", "重要な要因2", "..."],
  "recommendations": ["確認ポイント1", "確認ポイント2", "..."],
  "swot": {
    "strengths": ["強み1", "強み2"],
    "weaknesses": ["弱み1", "弱み2"],
    "opportunities": ["機会1", "機会2"],
    "threats": ["脅威1", "脅威2"]
  },
  "aiReflection": "200文字前後の自然な感想・考察"
}`.trim();
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
    edinetExtras?: EdinetExtras | null
  ): Promise<AnalysisResult> {
    try {
      const prompt = buildAnalysisPrompt(
        companyInfo,
        stockData,
        newsData,
        false,
        edinetExtras
      );

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: "anthropic/claude-sonnet-4-5",
          messages: [
            {
              role: "system",
              content: `あなたは企業情報と市場ニュースを整理する分析アシスタントです。投資助言、売買推奨、購入・売却・保有などの行動指示は出さず、参考情報として主要材料・リスク・確認ポイントを中立的にまとめてください。会社概要ではなく、業績・収益性・株価材料・リスクから「なぜ注目/注意すべきか」が伝わる分析結論を作ってください。回答はJSON形式で返してください。`,
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
            "HTTP-Referer": APP_URL,
            "X-Title": APP_NAME,
          },
          timeout: 30000,
        }
      );

      const data: OpenRouterResponse = response.data;
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error("AI分析結果が取得できませんでした");
      }

      return this.parseAnalysisResult(content);
    } catch (error: any) {
      console.error(
        "OpenRouter分析エラー:",
        error instanceof Error ? error.message : "Unknown error"
      );
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const apiMessage = error.response?.data?.error?.message;
        if (status === 401)
          throw new Error(
            "AI分析サービスの認証に失敗しました。APIキーを確認してください。"
          );
        if (status === 402)
          throw new Error("AI分析サービスの残高が不足しています。");
        if (status === 429)
          throw new Error(
            "AI分析サービスのリクエスト制限に達しました。しばらくしてから再試行してください。"
          );
        if (error.code === "ECONNABORTED")
          throw new Error(
            "AI分析がタイムアウトしました。しばらくしてから再試行してください。"
          );
        throw new Error(apiMessage || "AI分析中にエラーが発生しました。");
      }
      throw error;
    }
  }

  parseAnalysisResult(content: string): AnalysisResult {
    try {
      // JSON部分を抽出
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("JSON形式の分析結果が見つかりません");
      }

      const result = JSON.parse(jsonMatch[0]);

      return {
        analysisConclusion: result.analysisConclusion || "",
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
        aiReflection: result.aiReflection || "",
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
        analysisConclusion: "",
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
          model: "anthropic/claude-sonnet-4-5",
          messages: [
            {
              role: "system",
              content: `あなたは企業ニュースを整理する分析アシスタントです。投資助言や売買推奨は行わず、最新ニュースの材料性、注意点、確認ポイントを中立的にまとめてください。`,
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
            "HTTP-Referer": APP_URL,
            "X-Title": APP_NAME,
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
      console.error(
        "ニュース分析エラー:",
        error instanceof Error ? error.message : error
      );
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

以下の最新ニュースを分析し、この企業にとっての材料性と注意点を参考情報として整理してください：

${newsText}

以下のJSON形式で分析結果を返してください：
{
  "impact": "positive|negative|neutral",
  "impactScore": 数値(-100から100の間で、正の値は好材料寄り、負の値は悪材料寄りを示す),
  "analysis": "ニュースの総合的な材料整理と注意点",
  "keyPoints": ["重要なポイント1", "重要なポイント2", "..."],
  "recommendations": ["確認ポイント1", "確認ポイント2", "..."]
}
    `.trim();
  }

  async analyzeFinancials(
    companyName: string,
    symbol: string,
    financialData: any,
    edinetExtras?: EdinetExtras | null
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
          model: "anthropic/claude-sonnet-4-5",
          messages: [
            {
              role: "system",
              content:
                "あなたは財務データを整理する分析アシスタントです。BS/PL/CFを観点に、企業の財務健全性を5段階(1=弱い,5=強い)で評価し、日本語で簡潔に説明してください。投資助言や売買推奨は避け、必ず有効なJSONのみを返してください。",
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
            "HTTP-Referer": APP_URL,
            "X-Title": APP_NAME,
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
      console.error(
        "財務評価エラー:",
        error instanceof Error ? error.message : error
      );
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

  // fetch is used here instead of axios because axios does not natively support streaming SSE responses
  async *analyzeStockStream(
    companyInfo: any,
    stockData: any,
    newsData: any[],
    edinetExtras?: EdinetExtras | null,
    question?: string
  ): AsyncGenerator<string> {
    const prompt = buildAnalysisPrompt(
      companyInfo,
      stockData,
      newsData,
      true,
      edinetExtras,
      question
    );

    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": APP_URL,
        "X-Title": APP_NAME,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-5",
        messages: [
          {
            role: "system",
            content: `あなたは企業情報と市場ニュースを整理する分析アシスタントです。投資助言、売買推奨、購入・売却・保有などの行動指示は出さず、参考情報として主要材料・リスク・確認ポイントを中立的にまとめてください。会社概要ではなく、業績・収益性・株価材料・リスクから「なぜ注目/注意すべきか」が伝わる分析結論を作ってください。`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 3000,
        stream: true,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const status = res.status;
      if (status === 401)
        throw new Error(
          "AI分析サービスの認証に失敗しました。APIキーを確認してください。"
        );
      if (status === 402)
        throw new Error("AI分析サービスの残高が不足しています。");
      if (status === 429)
        throw new Error(
          "AI分析サービスのリクエスト制限に達しました。しばらくしてから再試行してください。"
        );
      throw new Error("AI分析中にエラーが発生しました。");
    }

    if (!res.body) throw new Error("AI分析中にエラーが発生しました。");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") return;
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            yield delta;
          }
        } catch {
          // ignore malformed SSE lines
        }
      }
    }
  }

  private buildFinancialsPrompt(
    companyName: string,
    symbol: string,
    financialData: any,
    edinetExtras?: EdinetExtras | null
  ) {
    const fd = financialData || {};
    const edinetSections = buildEdinetSections(edinetExtras);
    return `企業名: ${companyName}\nシンボル: ${symbol}\n\n以下の財務データ（存在する場合のみ）を参考に、BS/PL/CFを5段階で評価してください。指標が無い場合は一般的な水準を仮定せず、保守的に評価してください。\n\n【財務データの例】\n- 総資産: ${
      fd.totalAssets ?? "N/A"
    }\n- 自己資本比率: ${fd.equityRatio ?? "N/A"}\n- 負債比率: ${
      fd.debtRatio ?? "N/A"
    }\n- 売上高: ${fd.revenue ?? "N/A"}\n- 営業利益: ${
      fd.operatingIncome ?? "N/A"
    }\n- 当期純利益: ${fd.netIncome ?? "N/A"}\n- 営業CF: ${
      fd.operatingCashFlow ?? "N/A"
    }\n- 投資CF: ${fd.investingCashFlow ?? "N/A"}\n- 財務CF: ${
      fd.financingCashFlow ?? "N/A"
    }${edinetSections}\n\n【出力フォーマット（必ずこのJSONのみを返す）】\n{\n  "bs": { "score": 1-5, "summary": "BSの要点(短文)" },\n  "pl": { "score": 1-5, "summary": "PLの要点(短文)" },\n  "cf": { "score": 1-5, "summary": "CFの要点(短文)" },\n  "overall": { "score": 1-5, "label": "総合ラベル" },\n  "analysis": "総合所見(2〜4文)",\n  "recommendations": ["確認ポイント1", "確認ポイント2"]\n}`;
  }
}
