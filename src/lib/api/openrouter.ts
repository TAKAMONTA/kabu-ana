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
    newsData: any[]
  ): Promise<AnalysisResult> {
    try {
      const prompt = this.buildAnalysisPrompt(companyInfo, stockData, newsData);

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
            "HTTP-Referer": "https://ai-market-analyzer.com",
            "X-Title": "AI Market Analyzer",
          },
        }
      );

      const data: OpenRouterResponse = response.data;
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error("AI分析結果が取得できませんでした");
      }

      const analysisResult = this.parseAnalysisResult(content);
      
      // AI感想を生成
      const reflection = await this.generateReflection(companyInfo, stockData, newsData);
      analysisResult.aiReflection = reflection;

      return analysisResult;
    } catch (error) {
      console.error("OpenRouter分析エラー:", error);
      throw error;
    }
  }

  private buildAnalysisPrompt(
    companyInfo: any,
    stockData: any,
    newsData: any[]
  ): string {
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
      const reflectionPrompt = this.buildReflectionPrompt(companyInfo, stockData, newsData);

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
          temperature: 0.7, // より創造的で自然な文章のため
          max_tokens: 800,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://ai-market-analyzer.com",
            "X-Title": "AI Market Analyzer",
          },
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
}
