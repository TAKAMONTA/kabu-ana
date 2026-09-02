import axios from "axios";
import { NextRequest, NextResponse } from "next/server";
import {
  getFirestore,
  FieldValue,
  type DocumentData,
} from "firebase-admin/firestore";
import {
  OpenRouterClient,
  type OpenRouterResponse,
} from "@/lib/api/openrouter";
import { getAdminApp, isAuthError, verifyAuth } from "@/lib/auth/verifyAuth";
import { APP_NAME, APP_URL } from "@/lib/constants";
import { createMarketDataClient } from "@/lib/api/marketDataClient";
import { optionalWithTimeout } from "@/lib/utils/optionalTimeout";
import { withRateLimit } from "@/lib/utils/rateLimiter";
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
/** 1日の生成試行の上限（初回1回＋再試行2回）。AI課金の歯止め */
const MAX_ATTEMPTS_PER_DAY = 3;
/** AI が行を返さなかった銘柄に入れる代替テキスト */
const MISSING_LINE_TEXT = "この銘柄の要約を生成できませんでした";

/** 生成権の取得結果（トランザクションの戻り値） */
type Acquisition =
  | { kind: "ready"; data: DocumentData }
  | { kind: "generating" }
  | { kind: "error" }
  | { kind: "acquired"; attempts: number };

async function generateWithAi(prompt: string) {
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  // 未設定と .env.example のプレースホルダー値をどちらも弾く（claude-brief と同じ）
  if (
    !apiKey ||
    apiKey === "your_openrouter_api_key_here" ||
    apiKey === "your_openrouter_key_here"
  ) {
    throw new Error("OPENROUTER_API_KEYが設定されていません");
  }
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

async function getHandler(request: NextRequest) {
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

  // 生成権の取得。読み→判定→書きを1トランザクションにまとめることで、
  // 同時リクエストが競合しても AI 呼び出しは1本に絞られる（負けた側は
  // Firestore の自動再実行で generating を見て抜ける）
  let acquisition: Acquisition;
  try {
    acquisition = await db.runTransaction(async tx => {
      const snap = await tx.get(docRef);
      const cur = snap.data();

      if (cur?.status === "ready") {
        return { kind: "ready", data: cur } satisfies Acquisition;
      }
      if (cur?.status === "generating") {
        const createdMs = cur.createdAt?.toMillis?.() ?? 0;
        if (Date.now() - createdMs < GENERATING_STALE_MS) {
          return { kind: "generating" } satisfies Acquisition;
        }
        // 2分超は放置された生成とみなして取得し直す（下へ）
      }
      if (cur?.status === "error" && !retry) {
        return { kind: "error" } satisfies Acquisition;
      }

      const attempts =
        (typeof cur?.attempts === "number" ? cur.attempts : 0) + 1;
      if (attempts > MAX_ATTEMPTS_PER_DAY) {
        // 上限到達。AIは呼ばず error のまま返す（日付が変わればリセット）
        return { kind: "error" } satisfies Acquisition;
      }
      tx.set(docRef, {
        dateId,
        status: "generating",
        attempts,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { kind: "acquired", attempts } satisfies Acquisition;
    });
  } catch (error) {
    // 取得前の失敗。既存の ready を error で潰さないため、ここでは保存しない
    console.error(
      `digest: 生成権の取得に失敗しました: ${sanitizeError(error, [uid])}`
    );
    return NextResponse.json({ status: "error" });
  }

  if (acquisition.kind === "ready") {
    const existing = acquisition.data;
    return NextResponse.json({
      status: "ready",
      dateId: existing.dateId,
      marketLine: existing.marketLine,
      stockLines: existing.stockLines,
      focusLine: existing.focusLine,
      codes: existing.codes,
      // undefined のフィールドを応答に混ぜない
      ...(existing.asOf ? { asOf: existing.asOf } : {}),
    });
  }
  if (acquisition.kind === "generating") {
    return NextResponse.json({ status: "generating" });
  }
  if (acquisition.kind === "error") {
    return NextResponse.json({ status: "error" });
  }

  const attempts = acquisition.attempts;

  try {
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
    // AI が返した行のうち、ウォッチリストに実在するコードのものだけ採用する
    // （捏造行は捨てる。同じコードが複数来たら最初の1件を使う）
    const lineByCode = new Map<string, string>();
    for (const l of digest.stockLines) {
      if (!nameByCode.has(l.code) || lineByCode.has(l.code)) continue;
      lineByCode.set(l.code, l.line);
    }
    if (lineByCode.size === 0) {
      throw new Error("AI応答に対象銘柄の行が1件も含まれていません");
    }
    // 並びは入力（watchlist の addedAt 降順）に合わせ、欠けた銘柄は補完する
    const stockLines = stocks.map(s => ({
      code: s.code,
      name: s.name,
      line: lineByCode.get(s.code) ?? MISSING_LINE_TEXT,
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
      // 株価が全滅した日は asOf が無い。Firestore は undefined の書き込みを
      // 拒否して throw するため、フィールドごと落とす
      ...(asOf ? { asOf } : {}),
    };
    await docRef.set({
      ...payload,
      attempts,
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json(payload);
  } catch (error) {
    console.error(`digest: 生成に失敗しました: ${sanitizeError(error, [uid])}`);
    try {
      // 生成権を取得済みのときだけ error を書く（attempts は取得時の値を維持）
      await docRef.set({
        dateId,
        status: "error",
        attempts,
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

export const GET = withRateLimit(getHandler);
