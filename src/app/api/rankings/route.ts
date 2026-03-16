import { NextRequest, NextResponse } from "next/server";
import { EdinetDBClient } from "@/lib/api/edinetdb";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const metric = searchParams.get("metric") || "roe";
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 20);

    const edinetDbKey = process.env.EDINETDB_API_KEY;
    if (!edinetDbKey) {
      return NextResponse.json(
        { error: "EDINETDB_API_KEYが設定されていません" },
        { status: 400 }
      );
    }

    const edinetApi = new EdinetDBClient(edinetDbKey);
    const data = await edinetApi.getRanking(metric, limit);

    return NextResponse.json({ data, metric });
  } catch (error: any) {
    console.error("ランキングAPIエラー:", error);
    return NextResponse.json(
      { error: "ランキングの取得に失敗しました" },
      { status: 500 }
    );
  }
}
