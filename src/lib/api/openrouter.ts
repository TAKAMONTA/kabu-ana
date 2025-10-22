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
          max_tokens: 2000,
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

      return this.parseAnalysisResult(content);
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
  "recommendations": ["推奨事項1", "推奨事項2", "..."]
}
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
      };
    }
  }
}
