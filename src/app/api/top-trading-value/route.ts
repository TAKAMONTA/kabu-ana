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

interface OpenRouterRecommendation {
  name: string;
  code?: string;
  reason: string;
  confidence?: number;
  sources?: string[];
}

export const dynamic = "force-dynamic";
export const revalidate = 60 * 30; // 30分ごとに更新

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
    reason: "自動車業界の世界的リーダーとして堅調な販売を維持し、電動化や自動運転への取り組みも進む代表的銘柄。",
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
  
  console.log(`📰 収集したニュース数: ${uniqueNews.length}件`);
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
  if (!OPENROUTER_API_KEY) {
    throw new Error("openrouter_api_key_missing");
  }

  const prompt = buildNewsPrompt(news);

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "anthropic/claude-3.5-sonnet",
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
        "HTTP-Referer": "https://ai-market-analyzer.com",
        "X-Title": "AI Market Analyzer",
      },
    }
  );

  const content: string | undefined = response.data?.choices?.[0]?.message?.content;
  console.log("🔍 OpenRouter生レスポンス:", content);
  
  if (!content) {
    throw new Error("openrouter_empty_response");
  }

  const match = content.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error("❌ JSON抽出失敗。content:", content);
    throw new Error("openrouter_invalid_json");
  }

  const parsed = JSON.parse(match[0]);
  console.log("✅ パース成功:", JSON.stringify(parsed, null, 2));
  
  if (!Array.isArray(parsed.recommendations)) {
    console.error("❌ recommendations配列が見つかりません:", parsed);
    throw new Error("openrouter_missing_recommendations");
  }

  return parsed.recommendations as OpenRouterRecommendation[];
};

export async function GET() {
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
      console.error("OpenRouter呼び出しエラー:", openRouterError?.message || openRouterError);
      return NextResponse.json({
        items: buildFallbackItems(),
        error:
          openRouterError?.message === "openrouter_api_key_missing"
            ? "openrouter_api_key_missing"
            : "openrouter_failed",
      });
    }
  } catch (error: any) {
    console.error("top-trading-value エラー:", error?.message || error);
    return NextResponse.json({
      items: buildFallbackItems(),
      error: "ranking_fetch_failed",
    });
  }
}
