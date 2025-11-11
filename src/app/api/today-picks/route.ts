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

    const sanitizePicks = (
      picks: Array<{ name?: string; symbol?: string }>,
      news: Array<{ title: string }>
    ) => {
      const valid = (Array.isArray(picks) ? picks : [])
        .filter(item => {
          if (!item || typeof item.name !== "string") return false;
          const trimmed = item.name.trim();
          if (!trimmed) return false;
          const lower = trimmed.toLowerCase();
          return !["該当なし", "不明", "なし", "n/a"].some(ng =>
            lower.includes(ng)
          );
        })
        .map(item => ({
          name: item.name!.trim(),
          symbol: item.symbol ? item.symbol.trim().toUpperCase() : "",
        }));

      const needed = 3 - valid.length;
      if (needed > 0) {
        const fallback = news
          .filter(n => typeof n.title === "string" && n.title.trim().length > 0)
          .map(n => ({
            name: n.title.trim(),
            symbol: "",
          }))
          .filter(candidate => !valid.some(v => v.name === candidate.name))
          .slice(0, needed);

        valid.push(...fallback);
      }

      return valid.slice(0, 3);
    };

    const jpPicks = sanitizePicks(parsed.jp, jpNews);
    const usPicks = sanitizePicks(parsed.us, usNews);

    const usedFallback =
      jpPicks.length < 3 ||
      usPicks.length < 3 ||
      (Array.isArray(parsed.jp) &&
        jpPicks.some(
          item =>
            !parsed.jp?.some(
              original =>
                original?.name &&
                original.name.trim().toLowerCase() === item.name.toLowerCase()
            )
        )) ||
      (Array.isArray(parsed.us) &&
        usPicks.some(
          item =>
            !parsed.us?.some(
              original =>
                original?.name &&
                original.name.trim().toLowerCase() === item.name.toLowerCase()
            )
        ));

    return NextResponse.json({
      jp: jpPicks,
      us: usPicks,
      source: usedFallback ? "mixed" : "ai",
    });
  } catch (error: any) {
    console.error("today-picks エラー:", error?.message || error);
    // エラー時に固定のフォールバックデータを返す
    return NextResponse.json({ 
      jp: [
        { name: "日経平均株価", symbol: "^N225" },
        { name: "TOPIX", symbol: "^TOPX" },
        { name: "東証プライム市場", symbol: "" }
      ], 
      us: [
        { name: "S&P 500", symbol: "^GSPC" },
        { name: "NASDAQ", symbol: "^IXIC" },
        { name: "Dow Jones", symbol: "^DJI" }
      ],
      source: "fallback"
    }, { status: 200 });
  }
}


