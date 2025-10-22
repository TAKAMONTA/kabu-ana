// Perplexity API クライアント設定

interface PerplexitySearchRequest {
  query: string;
  return_citations?: boolean;
  return_images?: boolean;
  return_related_questions?: boolean;
}

interface PerplexityMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  created: number;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  citations?: string[];
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
    delta: {
      role: string;
      content: string;
    };
  }>;
}

class PerplexityClient {
  private apiKey: string;
  private baseUrl = "https://api.perplexity.ai";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(
    query: string,
    options?: Partial<PerplexitySearchRequest>
  ): Promise<PerplexityResponse> {
    const messages: PerplexityMessage[] = [
      {
        role: "system",
        content:
          "あなたは株価情報の専門家です。最新の株価情報と会社情報を提供してください。",
      },
      {
        role: "user",
        content: query,
      },
    ];

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar", // Perplexity API モデル
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("Perplexity API Error:", {
        status: response.status,
        statusText: response.statusText,
        error: error,
        body: JSON.stringify({ model: "sonar-small-online", messages }),
      });
      throw new Error(
        `Perplexity API error: ${response.status} - ${JSON.stringify(error)}`
      );
    }

    return response.json();
  }

  async searchStockInfo(
    stockCode: string,
    companyName?: string
  ): Promise<{
    companyInfo: any;
    latestNews: string[];
    stockPrice?: string;
    marketTrend?: string;
  }> {
    const searchQuery = companyName
      ? `${companyName} (${stockCode}) の最新の株価情報と会社概要とニュースと市場動向を教えてください。`
      : `日本株コード${stockCode} の会社名を教えて、最新の株価情報と会社概要とニュースと市場動向を教えてください。`;

    try {
      const response = await this.search(searchQuery, {
        return_citations: true,
      });

      const content = response.choices[0]?.message?.content || "";

      // レスポンスから情報を抽出し、適切な形式で返す
      return {
        companyInfo: {
          description: content,
          citations: response.citations || [],
        },
        latestNews: response.citations || [],
        stockPrice: this.extractStockPrice(content),
        marketTrend: this.extractMarketTrend(content),
      };
    } catch (error: unknown) {
      console.error("Perplexity search error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Perplexity search failed: ${errorMessage}`);
    }
  }

  private extractStockPrice(content: string): string | undefined {
    // 株価情報を抽出するシンプルな正規表現
    const priceMatch = content.match(/([0-9,]+\.?[0-9]*)\s*円/);
    return priceMatch ? priceMatch[1] : undefined;
  }

  private extractMarketTrend(content: string): string | undefined {
    // 市場トレンドを抽出するシンプルな判定
    if (content.includes("上昇") || content.includes("好調")) return "bullish";
    if (content.includes("下降") || content.includes("低迷")) return "bearish";
    return "neutral";
  }
}

let perplexityClient: PerplexityClient | null = null;

export function getPerplexityClient(): PerplexityClient {
  if (!perplexityClient) {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error("PERPLEXITY_API_KEY is not set in environment variables");
    }
    perplexityClient = new PerplexityClient(apiKey);
  }
  return perplexityClient;
}

export {
  PerplexityClient,
  type PerplexitySearchRequest,
  type PerplexityResponse,
};
