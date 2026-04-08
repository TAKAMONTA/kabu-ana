import { NextRequest, NextResponse } from "next/server";
import { EdinetDBClient } from "@/lib/api/edinetdb";
import { OpenRouterClient } from "@/lib/api/openrouter";
import { verifyAuth, isAuthError } from "@/lib/auth/verifyAuth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const edinetCode = searchParams.get("edinet_code");

    if (!edinetCode) {
      return NextResponse.json(
        { error: "edinet_codeが必要です" },
        { status: 400 }
      );
    }

    const edinetDbKey = process.env.EDINETDB_API_KEY;
    if (!edinetDbKey) {
      return NextResponse.json(
        { error: "EDINETDB_API_KEYが設定されていません" },
        { status: 400 }
      );
    }

    const edinetApi = new EdinetDBClient(edinetDbKey);
    const textBlocks = await edinetApi.getTextBlocks(edinetCode);

    return NextResponse.json({ data: textBlocks });
  } catch (error: any) {
    console.error("有報テキスト取得エラー:", error);
    return NextResponse.json(
      { error: "有報テキストの取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 認証チェック（AI要約はコストがかかるため）
    const authResult = await verifyAuth(request);
    if (isAuthError(authResult)) return authResult;

    const { edinetCode, companyName, sections } = await request.json();

    if (!edinetCode || !companyName) {
      return NextResponse.json(
        { error: "edinetCodeとcompanyNameが必要です" },
        { status: 400 }
      );
    }

    const edinetDbKey = process.env.EDINETDB_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    if (!edinetDbKey) {
      return NextResponse.json({ error: "EDINETDB_API_KEYが設定されていません" }, { status: 400 });
    }
    if (!openrouterKey) {
      return NextResponse.json({ error: "OPENROUTER_API_KEYが設定されていません" }, { status: 400 });
    }

    const edinetApi = new EdinetDBClient(edinetDbKey);
    const openRouter = new OpenRouterClient(openrouterKey);

    // テキストブロックを取得
    const textBlocks = sections ?? await edinetApi.getTextBlocks(edinetCode);
    if (!textBlocks || textBlocks.length === 0) {
      return NextResponse.json({ error: "有報テキストが見つかりませんでした" }, { status: 404 });
    }

    // 主要セクションを抽出してAI要約
    const importantSections = textBlocks
      .filter((b: any) => b.content && b.content.length > 50)
      .slice(0, 8);

    const combinedText = importantSections
      .map((b: any) => `【${b.section || b.title || "セクション"}】\n${b.content?.slice(0, 800) || ""}`)
      .join("\n\n");

    const summaryPrompt = `以下は${companyName}の有価証券報告書のテキストです。投資家として重要なポイントを抽出・要約してください。

${combinedText}

以下のJSON形式で返してください：
{
  "summary": "全体の要約（200字以内）",
  "businessModel": "事業モデルの特徴（100字以内）",
  "keyRisks": ["主要リスク1", "主要リスク2", "主要リスク3"],
  "growthDrivers": ["成長要因1", "成長要因2"],
  "investmentPoints": ["投資判断に重要なポイント1", "ポイント2", "ポイント3"]
}`;

    const axios = require("axios");
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "anthropic/claude-3.5-sonnet",
        messages: [
          {
            role: "system",
            content: "あなたは有価証券報告書を分析するプロの証券アナリストです。投資判断に必要な情報を簡潔に要約してください。必ずJSONのみを返してください。",
          },
          { role: "user", content: summaryPrompt },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://kabu-ana.com",
          "X-Title": "AI Market Analyzer",
        },
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    const jsonMatch = content?.match(/\{[\s\S]*\}/);
    const aiSummary = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    return NextResponse.json({
      textBlocks,
      aiSummary,
    });
  } catch (error: any) {
    console.error("有報テキストAI要約エラー:", error);
    return NextResponse.json(
      { error: "有報テキストの要約に失敗しました" },
      { status: 500 }
    );
  }
}
