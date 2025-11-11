import { NextRequest, NextResponse } from "next/server";
import { FreeNewsClient } from "@/lib/api/freeNews";
import { OpenRouterClient } from "@/lib/api/openrouter";

export async function GET(_req: NextRequest) {
  try {
    const freeNews = new FreeNewsClient();

    // ニュースを取得（直近の日本株/米株キーワード）
    const [jpNews, usNews] = await Promise.all([
      freeNews.getNewsFromGoogleRSS("日本株 OR 東証 OR 日経平均", 20),
      freeNews.getNewsFromGoogleRSS("米国株 OR NASDAQ OR NYSE OR S&P500", 20),
    ]);

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey || openrouterKey === "your_openrouter_key_here") {
      // AIキーが無い場合は、単純にニュースタイトル上位の固有名抽出はせず、タイトルをそのまま返す（簡易フォールバック）
      return NextResponse.json({
        jp: jpNews.slice(0, 3).map(n => ({ name: n.title, symbol: "" })),
        us: usNews.slice(0, 3).map(n => ({ name: n.title, symbol: "" })),
        source: "fallback",
      });
    }

    const ai = new OpenRouterClient(openrouterKey);
    const system = `あなたは株式アナリストです。日本株と米国株のニュース見出しから、今日の注目銘柄を日本株3つ、米株3つ選定してください。各銘柄は { name, symbol } 形式。証券コード/ティッカーが分からない場合は空文字で。JSONのみを返すこと。`;
    const user = `日本株ニュース:\n- ${jpNews.map(n => n.title).join("\n- ")}\n\n米国株ニュース:\n- ${usNews.map(n => n.title).join("\n- ")}\n\n出力フォーマット:\n{ "jp": [{"name":"","symbol":""},...3件], "us": [{"name":"","symbol":""},...3件] }`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://kabu-ana.com",
        "X-Title": "AI Market Analyzer",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: 800,
      }),
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { jp: [], us: [] };

    let jpPicks = Array.isArray(parsed.jp) ? parsed.jp : [];
    let usPicks = Array.isArray(parsed.us) ? parsed.us : [];

    // 最終フォールバック：空ならニュース見出し上位を使用
    if (jpPicks.length === 0) {
      jpPicks = jpNews.slice(0, 3).map(n => ({ name: n.title || "該当なし", symbol: "" }));
    }
    if (usPicks.length === 0) {
      usPicks = usNews.slice(0, 3).map(n => ({ name: n.title || "該当なし", symbol: "" }));
    }

    return NextResponse.json({ jp: jpPicks, us: usPicks, source: "ai" });
  } catch (error: any) {
    console.error("today-picks エラー:", error?.message || error);
    return NextResponse.json({ jp: [], us: [], error: "failed" }, { status: 200 });
  }
}


