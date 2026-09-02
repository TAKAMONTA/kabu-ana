import axios from "axios";
import { NextRequest, NextResponse } from "next/server";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  OpenRouterClient,
  type OpenRouterResponse,
} from "@/lib/api/openrouter";
import { getAdminApp, isAuthError, verifyAuth } from "@/lib/auth/verifyAuth";
import { APP_NAME, APP_URL } from "@/lib/constants";
import { createMarketDataClient } from "@/lib/api/marketDataClient";
import { optionalWithTimeout } from "@/lib/utils/optionalTimeout";
import { sanitizeError } from "@/lib/utils/logSanitizer";
import { jstDateId } from "@/lib/digest/dateId";
import { buildDigestPrompt, type DigestStockInput } from "@/lib/digest/prompt";
import { parseDigestResponse } from "@/lib/digest/schema";

export const dynamic =
  process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

/** 要約対象の銘柄数上限（超過分は対象外） */
const MAX_DIGEST_STOCKS = 10;
/** これより古い generating は死んだ生成とみなして作り直す */
const GENERATING_STALE_MS = 2 * 60 * 1000;
/** 1銘柄あたりの外部データ取得タイムアウト */
const FETCH_TIMEOUT_MS = 8000;

async function generateWithAi(prompt: string) {
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  if (!apiKey) throw new Error("OPENROUTER_API_KEYが設定されていません");
  const client = new OpenRouterClient(apiKey) as unknown as {
    baseURL: string;
    apiKey: string;
  };
  const response = await axios.post(
    `${client.baseURL}/chat/completions`,
    {
      model: "anthropic/claude-sonnet-4-5",
      messages: [
        {
          role: "system",
          content:
            "あなたは日本の個人投資家向けアプリのアナリストです。事実の整理と注目点の提示だけを行い、売買の推奨はしません。回答はJSONのみです。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    },
    {
      headers: {
        Authorization: `Bearer ${client.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": APP_URL,
        "X-Title": APP_NAME,
      },
      timeout: 30000,
    }
  );
  const data: OpenRouterResponse = response.data;
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("AI応答が空です");
  return parseDigestResponse(content);
}

export async function GET(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "empty" });
  }

  const authResult = await verifyAuth(request);
  if (isAuthError(authResult)) {
    return authResult;
  }
  const uid = authResult.uid;
  const dateId = jstDateId(Date.now());
  const retry = request.nextUrl.searchParams.get("retry") === "1";
  const db = getFirestore(getAdminApp());
  // users/{uid} 配下に保存する。退会時の recursiveDelete(users/{uid}) が
  // 自動で拾うため、専用の削除経路・uid フィールドが不要になる
  const userRef = db.doc(`users/${uid}`);
  const docRef = userRef.collection("digests").doc(dateId);

  try {
    const snapshot = await docRef.get();
    const existing = snapshot.data();

    if (existing?.status === "ready") {
      return NextResponse.json({
        status: "ready",
        dateId: existing.dateId,
        marketLine: existing.marketLine,
        stockLines: existing.stockLines,
        focusLine: existing.focusLine,
        codes: existing.codes,
        asOf: existing.asOf,
      });
    }
    if (existing?.status === "generating") {
      const createdMs = existing.createdAt?.toMillis?.() ?? 0;
      if (Date.now() - createdMs < GENERATING_STALE_MS) {
        return NextResponse.json({ status: "generating" });
      }
      // 2分超は放置された生成とみなし、下で作り直す
    }
    if (existing?.status === "error" && !retry) {
      return NextResponse.json({ status: "error" });
    }

    if (existing) {
      // error の再試行 / 放置 generating の作り直し。
      // まれに同時実行で二重生成になり得るが、コストは1回分で許容する
      await docRef.set({
        dateId,
        status: "generating",
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      try {
        // create は既存があると失敗する = 同時オープンでも生成は1本に絞られる
        await docRef.create({
          dateId,
          status: "generating",
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch {
        return NextResponse.json({ status: "generating" });
      }
    }

    // 一覧の表示順（addedAt 降順）の先頭 N 銘柄を対象にする
    const watchSnapshot = await userRef
      .collection("watchlist")
      .orderBy("addedAt", "desc")
      .limit(MAX_DIGEST_STOCKS)
      .get();

    if (watchSnapshot.empty) {
      // 0件のダイジェスト実体は残さない（登録後の初回生成を妨げないため）
      await docRef.delete();
      return NextResponse.json({ status: "empty" });
    }

    const stocks = watchSnapshot.docs.map(d => {
      const data = d.data();
      return {
        code: typeof data.code === "string" ? data.code : d.id,
        name: typeof data.name === "string" ? data.name : d.id,
      };
    });

    const marketApi = createMarketDataClient();
    const inputs: DigestStockInput[] = await Promise.all(
      stocks.map(async s => {
        const [quote, news] = await Promise.all([
          optionalWithTimeout(
            marketApi.getStockData(s.code),
            FETCH_TIMEOUT_MS,
            `digest quote ${s.code}`
          ),
          optionalWithTimeout(
            marketApi.getCompanyNews(s.code, 2),
            FETCH_TIMEOUT_MS,
            `digest news ${s.code}`
          ),
        ]);
        const hasPrice =
          quote !== null && Number.isFinite(quote.price) && quote.price > 0;
        return {
          code: s.code,
          name: s.name,
          close: hasPrice ? quote.price : undefined,
          changePercent: hasPrice ? quote.changePercent : undefined,
          asOf: hasPrice ? quote.asOf : undefined,
          headlines: (news ?? []).slice(0, 2).map(n => n.title),
        };
      })
    );

    if (inputs.every(i => i.close === undefined && i.headlines.length === 0)) {
      throw new Error("全銘柄でデータ取得に失敗しました");
    }

    const digest = await generateWithAi(buildDigestPrompt(inputs));
    const nameByCode = new Map(stocks.map(s => [s.code, s.name]));
    const stockLines = digest.stockLines.map(l => ({
      code: l.code,
      name: nameByCode.get(l.code) ?? l.code,
      line: l.line,
    }));
    const asOf = inputs
      .map(i => i.asOf)
      .filter((v): v is string => Boolean(v))
      .sort()
      .pop();

    const payload = {
      status: "ready" as const,
      dateId,
      marketLine: digest.marketLine,
      stockLines,
      focusLine: digest.focusLine,
      codes: stocks.map(s => s.code),
      asOf,
    };
    await docRef.set({
      ...payload,
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json(payload);
  } catch (error) {
    console.error(`digest: 生成に失敗しました: ${sanitizeError(error, [uid])}`);
    try {
      await docRef.set({
        dateId,
        status: "error",
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (saveError) {
      console.error(
        `digest: error状態の保存にも失敗: ${sanitizeError(saveError, [uid])}`
      );
    }
    return NextResponse.json({ status: "error" });
  }
}
