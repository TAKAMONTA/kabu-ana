import { NextResponse } from "next/server";
import type { APIResponse } from "@/app/types";

// AI分析による人気株のサンプルデータ
const TRENDING_STOCKS = {
  japan: [
    {
      code: "7203",
      name: "トヨタ自動車",
      reason: "EV市場の拡大と技術革新が注目",
    },
    {
      code: "6758",
      name: "ソニーグループ",
      reason: "ゲーム事業の成長とエンターテイメント分野の拡大",
    },
    { code: "9432", name: "NTT", reason: "IOWN構想と6G開発の推進" },
    { code: "6861", name: "キーエンス", reason: "FA分野での高成長と高収益" },
    { code: "4755", name: "楽天グループ", reason: "デジタル事業の多角化展開" },
  ],
  us: [
    { code: "NVDA", name: "NVIDIA", reason: "AI半導体の需要拡大と技術革新" },
    {
      code: "MSFT",
      name: "Microsoft",
      reason: "AI事業の成長とクラウドサービス",
    },
    { code: "AAPL", name: "Apple", reason: "Vision ProとiPhone事業の拡大" },
    { code: "TSLA", name: "Tesla", reason: "電気自動車市場の成長と技術革新" },
    { code: "META", name: "Meta", reason: "メタバースとAI事業の展開" },
  ],
};

export async function GET() {
  try {
    // 将来的にはPerplexity APIやOpenAIを使用
    // リアルタイムで人気株を取得する予定

    return NextResponse.json({
      success: true,
      data: TRENDING_STOCKS,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Trending stocks error:", error);
    const errorMessage = error instanceof Error ? error.message : "人気株の取得でエラーが発生しました";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
