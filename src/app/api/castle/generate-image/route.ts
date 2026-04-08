import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { CastleRank } from "@/components/castle/types";
import { generateCastlePrompt } from "@/lib/castle/generateCastlePrompt";
import { verifyAuth, isAuthError } from "@/lib/auth/verifyAuth";

// OpenAIクライアントを遅延初期化（ビルド時のエラーを防ぐため）
function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const authResult = await verifyAuth(request);
    if (isAuthError(authResult)) return authResult;

    const { rank, companyName } = await request.json();

    if (!rank || !companyName) {
      return NextResponse.json(
        { error: "ランクと企業名が必要です" },
        { status: 400 }
      );
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json(
        { error: "OpenAI APIキーが設定されていません" },
        { status: 500 }
      );
    }

    // ランクに応じたプロンプトを生成
    const prompt = generateCastlePrompt(rank as CastleRank, companyName);

    // DALL-E 3で画像を生成
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "vivid",
    });

    // response.dataがundefinedの可能性をチェック
    if (!response.data || response.data.length === 0) {
      return NextResponse.json(
        { error: "画像の生成に失敗しました（データが取得できませんでした）" },
        { status: 500 }
      );
    }

    const imageUrl = response.data[0]?.url;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "画像の生成に失敗しました（画像URLが取得できませんでした）" },
        { status: 500 }
      );
    }

    return NextResponse.json({ imageUrl });
  } catch (error: any) {
    console.error("画像生成エラー:", error);

    // OpenAI API エラーの詳細を返す
    if (error.status === 400) {
      return NextResponse.json(
        { error: "画像生成リクエストが無効です: " + error.message },
        { status: 400 }
      );
    }

    if (error.status === 429) {
      return NextResponse.json(
        { error: "API制限に達しました。しばらく待ってから再試行してください。" },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "画像生成に失敗しました: " + error.message },
      { status: 500 }
    );
  }
}
