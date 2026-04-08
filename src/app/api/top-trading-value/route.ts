import { NextResponse } from "next/server";
import axios from "axios";
import { FreeNewsClient } from "@/lib/api/freeNews";

interface RankingItem {
  rank: number;
  code: string;
  name: string;
  reason: string;
  confidence: number;
  sources: string[];
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  value: number;
  priceDisplay: string;
  changeDisplay: string;
  volumeDisplay: string;
  valueDisplay: string;
}

const ESCAPED_DOUBLE_QUOTE = '\\"';

interface OpenRouterRecommendation {
  name: string;
  code?: string;
  reason: string;
  confidence?: number;
  sources?: string[];
}

// export const dynamic = "force-dynamic";
export const revalidate = 60 * 30; // 30分ごとに更新

export const dynamic = process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const NEWS_TOPICS = [
  "日本株 市況",
  "トヨタ自動車",
  "ソニーグループ",
  "半導体 日本株",
  "ソフトバンクグループ AI",
];
const NEWS_LIMIT_PER_TOPIC = 5;

const POPULAR_FALLBACK_STOCKS: Array<{
  code: string;
  name: string;
  reason: string;
}> = [
  {
    code: "7203",
    name: "トヨタ自動車",
    reason: "自動車業界の世界的リーダーとして堅調な販売を維持し、電動化や自動運転への取り組みも進む代表的銘銘柄。",
  },
  {
    code: "6758",
    name: "ソニーグループ",
    reason: "エンタメ・半導体・金融など複数の柱を持つ大型株。ゲームやAI向けイメージセンサーに注目。",
  },
  {
    code: "8035",
    name: "東京エレクトロン",
    reason: "半導体製造装置で世界シェア上位。生成AI需要による半導体投資拡大が追い風。",
  },
  {
    code: "7974",
    name: "任天堂",
    reason: "世界的な人気IPとハードを持つゲーム企業。新ハード発表や大型タイトルに常に注目が集まる。",
  },
  {
    code: "9984",
    name: "ソフトバンクグループ",
    reason: "投資事業を通じてAIやテック関連のニュースが多く、マーケットの話題を集めやすい。",
  },
];

const buildFallbackItems = (): RankingItem[] =>
  POPULAR_FALLBACK_STOCKS.map((stock, index) => ({
    rank: index + 1,
    code: stock.code,
    name: stock.name,
    reason: stock.reason,
    confidence: 0.5,
    sources: [],
    price: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    value: 0,
    priceDisplay: "-",
    changeDisplay: "-",
    volumeDisplay: "-",
    valueDisplay: "-",
  }));

const sanitizeRecommendations = (
  recs: OpenRouterRecommendation[]
): RankingItem[] => {
  return recs.slice(0, 5).map((rec, index) => ({
    rank: index + 1,
    code: rec.code?.replace(/[^0-9A-Za-z]/g, "") || "",
    name: rec.name?.trim() || `銘柄${index + 1}`,
    reason: rec.reason?.trim() || "注目理由を取得できませんでした。",
    confidence: Math.max(0, Math.min(1, rec.confidence ?? 0.5)),
    sources: Array.isArray(rec.sources)
      ? rec.sources.filter(src => typeof src === "string" && src.length > 0)
      : [],
    price: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    value: 0,
    priceDisplay: "-",
    changeDisplay: "-",
    volumeDisplay: "-",
    valueDisplay: "-",
  }));
};

const sanitizeOpenRouterJson = (input: string): string => {
  let insideString = false;
  let escaped = false;
  let result = "";

  const isStructural = (char: string | undefined) =>
    char === undefined ||
    char === "," ||
    char === "]" ||
    char === "}" ||
    char === ":";

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (!insideString) {
      if (char === '"') {
        insideString = true;
      }
      result += char;
      continue;
    }

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) {
        j++;
      }
      const nextChar = input[j];

      if (!isStructural(nextChar)) {
        result += '\\"';
        continue;
      }

      insideString = false;
      result += char;
      continue;
    }

    result += char;
  }

  return result;
};

const fetchMarketNews = async () => {
  const newsClient = new FreeNewsClient();
  const allNews: any[] = [];
  
  // 複数のトピックからニュースを収集
  for (const topic of NEWS_TOPICS) {
    try {
      const news = await newsClient.getComprehensiveNews(topic, undefined, NEWS_LIMIT_PER_TOPIC);
      allNews.push(...news);
    } catch (error) {
      console.warn(`⚠️ トピック「${topic}」のニュース取得失敗:`, error);
    }
  }
  
  // 重複を除去（タイトルベース）
  const uniqueNews = Array.from(
    new Map(allNews.map(item => [item.title, item])).values()
  );
  
  return uniqueNews.slice(0, 20); // 最大20件に制限
};

const buildNewsPrompt = (news: any[]): string => {
  const newsText = news
    .map((item, idx) => {
      const date = item.date || "不明";
      return `${idx + 1}. タイトル: ${item.title || "タイトルなし"}
概要: ${item.snippet || "概要なし"}
ソース: ${item.source || "不明"}
日付: ${date}`;
    })
    .join("\n\n");

  return `あなたは日本株マーケットをウォッチしているプロのアナリストです。

以下のニュースをもとに、**今日特に注目すべき日本株銘柄を5つ**選んでください。

【選定基準】
- ニュースで具体的に言及されている企業を優先
- 業績好調、新製品発表、M&A、政策の恩恵など、株価上昇の材料がある銘柄
- 投資家が「この銘柄調べてみたい」と思うような話題性のある銘柄

【表記ルール】
- JSON構造（キーや配列括弧）以外の場所に出現するダブルクォート（"）はすべて バックスラッシュとダブルクォート（\\"）のようにエスケープしてください。
- 可能であれば引用には全角の「」を使い、ASCIIのダブルクォートは構造部分（キー・配列）に限定してください。
- reason / sources に含めるテキストは記事タイトルや要約に留め、改行やURL・HTMLタグ・特殊記号は含めないでください。

【出力形式】（必ずこのJSON形式のみで回答）
{
  "recommendations": [
    {
      "name": "企業名（例: トヨタ自動車）",
      "code": "4桁の証券コード（例: 7203。不明な場合は空文字）",
      "reason": "注目理由を50文字程度で簡潔に（ニュースの内容に基づく）",
      "confidence": 0.0〜1.0の小数（確信度）,
      "sources": ["参照したニュースのタイトル（最大2つ）"]
    }
  ]
}

【ニュース一覧】
${newsText}

**必ず5銘柄を選び、上記JSON形式のみで回答してください。**`;
};

const callOpenRouter = async (news: any[]) => {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.trim() === "") {
    throw new Error("openrouter_api_key_missing");
  }

  const prompt = buildNewsPrompt(news);

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "anthropic/claude-sonnet-4",
        temperature: 0.4,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content:
              "あなたは日本株市場を分析するプロのアナリストです。与えられたニュースから、投資家が興味を持ちそうな注目銘柄を必ず5つ選び、指定したJSON形式のみで回答してください。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://kabu-ana.com",
          "X-Title": "AI Market Analyzer",
        },
        timeout: 30000, // 30秒のタイムアウト
      }
    );

    if (response.data?.error) {
      throw new Error(`openrouter_api_error: ${JSON.stringify(response.data.error)}`);
    }

    const content: string | undefined = response.data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("openrouter_empty_response");
    }

    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("❌ JSON抽出失敗。content:", content);
      throw new Error("openrouter_invalid_json");
    }

    let parsed;
    try {
      const cleaned = sanitizeOpenRouterJson(match[0]);
      parsed = JSON.parse(cleaned);
    } catch (parseError: any) {
      console.error("JSONパースエラー:", parseError?.message);
      throw new Error("openrouter_parse_error");
    }

    if (!Array.isArray(parsed.recommendations)) {
      throw new Error("openrouter_missing_recommendations");
    }
    return parsed.recommendations as OpenRouterRecommendation[];
  } catch (axiosError: any) {
    if (axios.isAxiosError(axiosError)) {
      console.error("❌ OpenRouter API呼び出しエラー:", axiosError.response?.status, axiosError.message);
      
      if (axiosError.code === 'ECONNABORTED') {
        throw new Error("openrouter_timeout");
      }
      
      const status = axiosError.response?.status;
      if (status === 401) {
        throw new Error("openrouter_unauthorized");
      } else if (status === 429) {
        throw new Error("openrouter_rate_limit");
      } else if (status !== undefined && status >= 500) {
        throw new Error("openrouter_server_error");
      }
    }
    throw axiosError;
  }
};

export async function GET() {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }
  try {
    const news = await fetchMarketNews();

    if (news.length === 0) {
      console.warn("ニュースが取得できませんでした。フォールバックを使用します。");
      return NextResponse.json({
        items: buildFallbackItems(),
        error: "news_unavailable",
      });
    }

    try {
      const recommendations = await callOpenRouter(news);
      
      // 結果が少ない場合はフォールバックと混在させる
      if (recommendations.length === 0) {
        console.warn("OpenRouterから推奨銘柄が返りませんでした。フォールバックに切り替えます。");
        return NextResponse.json({
          items: buildFallbackItems(),
          error: "openrouter_empty",
        });
      }
      
      const sanitized = sanitizeRecommendations(recommendations);
      
      // 5件未満の場合はフォールバックで補完
      if (sanitized.length < 5) {
        console.warn(`⚠️ LLM推奨が${sanitized.length}件のみ。フォールバックで補完します。`);
        const fallbackItems = buildFallbackItems();
        const combined = [
          ...sanitized,
          ...fallbackItems.slice(0, 5 - sanitized.length)
        ].map((item, index) => ({ ...item, rank: index + 1 }));
        
        return NextResponse.json({
          items: combined,
          metadata: {
            source: "openrouter_with_fallback",
            newsCount: news.length,
            llmCount: sanitized.length,
          },
        });
      }

      return NextResponse.json({
        items: sanitized,
        metadata: {
          source: "openrouter_news_analysis",
          newsCount: news.length,
        },
      });
    } catch (openRouterError: any) {
      const errorMessage = openRouterError?.message || String(openRouterError);
      console.error("OpenRouter呼び出しエラー:", errorMessage);
      
      // エラーコードを抽出
      let errorCode = "openrouter_failed";
      if (errorMessage.includes("openrouter_api_key_missing")) {
        errorCode = "openrouter_api_key_missing";
      } else if (errorMessage.includes("openrouter_timeout")) {
        errorCode = "openrouter_timeout";
      } else if (errorMessage.includes("openrouter_unauthorized")) {
        errorCode = "openrouter_unauthorized";
      } else if (errorMessage.includes("openrouter_rate_limit")) {
        errorCode = "openrouter_rate_limit";
      } else if (errorMessage.includes("openrouter_server_error")) {
        errorCode = "openrouter_server_error";
      } else if (errorMessage.includes("openrouter_empty_response")) {
        errorCode = "openrouter_empty";
      } else if (errorMessage.includes("openrouter_invalid_json") || errorMessage.includes("openrouter_parse_error")) {
        errorCode = "openrouter_invalid_response";
      }
      
      return NextResponse.json({
        items: buildFallbackItems(),
        error: errorCode,
        errorDetails: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      });
    }
  } catch (error: any) {
    console.error("top-trading-value エラー:", error?.message || "Unknown error");
    // エラーレスポンスを確実にJSON形式で返す
    return NextResponse.json(
      {
        items: buildFallbackItems(),
        error: "ranking_fetch_failed",
      },
      { status: 200 } // エラーでも200を返して、クライアント側でエラーメッセージを表示
    );
  }
}
