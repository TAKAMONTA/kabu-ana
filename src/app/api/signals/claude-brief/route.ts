import axios from "axios";
import { NextRequest, NextResponse } from "next/server";
import {
  OpenRouterClient,
  type OpenRouterResponse,
} from "@/lib/api/openrouter";
import { getOpenRouterApiKey } from "@/lib/api/openrouterConfig";
import { isAuthError, verifyAuth } from "@/lib/auth/verifyAuth";
import { APP_NAME, APP_URL } from "@/lib/constants";
import {
  fail,
  getSignalsDb,
  logSignalError,
  ok,
  previousDayId,
  SIGNAL_NOT_CONFIGURED_MESSAGE,
  todayId,
} from "@/lib/signals/cache";
import {
  buildDeepDivePrompt,
  buildMorningBriefPrompt,
  claudeDeepDiveRequestSchema,
  claudeDeepDiveSchema,
  claudeMorningBriefSchema,
  extractJsonObject,
  type ClaudeDeepDive,
  type ClaudeMorningBrief,
} from "@/lib/signals/claude";
import {
  decideBriefGeneration,
  hasBriefSourceData,
  isBriefReady,
  mergeBriefSourceFallbacks,
  type BriefDocState,
  type BriefGenerationDecision,
  type BriefSourceInput,
} from "@/lib/signals/briefCache";
import { withRateLimit } from "@/lib/utils/rateLimiter";
import { isSubscriptionPremium } from "@/lib/types/subscription";
import { maskId } from "@/lib/utils/logSanitizer";

export const dynamic = "force-dynamic";

const BRIEF_COLLECTION = "signals_brief";
/** 内部のシグナルAPI（ソースの取り直し）1本あたりのタイムアウト */
const INTERNAL_SIGNAL_TIMEOUT_MS = 20_000;
/** 1日あたりの深掘り分析の上限（プレミアム） */
const MAX_DEEP_DIVES_PER_DAY = 10;

const BRIEF_GENERATING_MESSAGE =
  "本日の市場ブリーフを作成中です。しばらくしてから再度お試しください。";
const BRIEF_UNAVAILABLE_MESSAGE =
  "本日の市場ブリーフを作成できませんでした。時間をおいて再度お試しください。";
const DEEP_DIVE_FAILED_MESSAGE =
  "深掘り分析に失敗しました。時間をおいて再度お試しください。";

interface BriefPayload {
  brief: ClaudeMorningBrief;
  generatedAt: string;
}

/** 保存文書から応答用の { brief, generatedAt } だけを取り出す */
function toBriefPayload(state: BriefDocState | undefined | null): BriefPayload | null {
  if (!state || !isBriefReady(state)) return null;
  return {
    brief: state.brief as ClaudeMorningBrief,
    generatedAt: state.generatedAt as string,
  };
}

async function readBriefSources(): Promise<BriefSourceInput> {
  const dateId = todayId();
  // Firestore の取得は1回にまとめ、4文書を並列に読む
  const db = await getSignalsDb();
  if (!db) return {};
  const read = async <T>(collection: string): Promise<T | null> => {
    const snapshot = await db.collection(collection).doc(dateId).get();
    return snapshot.exists ? (snapshot.data() as T) : null;
  };
  const [prices, news, seismic, risk] = await Promise.all([
    read<NonNullable<BriefSourceInput["prices"]>>("signals_prices"),
    read<NonNullable<BriefSourceInput["news"]>>("signals_news"),
    read<NonNullable<BriefSourceInput["seismic"]>>("signals_seismic"),
    read<NonNullable<BriefSourceInput["risk"]>>("signals_risk"),
  ]);
  return { prices, news, seismic, risk };
}

async function callInternalSignal(path: string, origin: string) {
  try {
    const response = await fetch(`${origin}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(INTERNAL_SIGNAL_TIMEOUT_MS),
    });
    return await response.json().catch(() => null);
  } catch (error) {
    logSignalError(`claude-brief: ${path} の取得に失敗しました`, error);
    return null;
  }
}

async function refreshBriefSources(origin: string): Promise<BriefSourceInput> {
  const [prices, news, seismic] = await Promise.all([
    callInternalSignal("/api/signals/prices", origin),
    callInternalSignal("/api/signals/news", origin),
    callInternalSignal("/api/signals/seismic", origin),
  ]);
  const risk = await callInternalSignal("/api/signals/risk", origin);
  const persisted = await readBriefSources();
  return mergeBriefSourceFallbacks(persisted, {
    prices: prices?.data ?? null,
    news: news?.data ?? null,
    seismic: seismic?.data ?? null,
    risk: risk?.data ?? null,
  });
}

async function callOpenRouterJson<T>(
  apiKey: string,
  prompt: string,
  schema: { parse: (value: unknown) => T }
): Promise<T> {
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
            "あなたは日本株市場向けの地政学・エネルギー市場アナリストです。回答はJSONのみです。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1800,
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
  if (!content) throw new Error("Claude応答が空です");
  return schema.parse(extractJsonObject(content));
}

/**
 * GET: 朝の市場ブリーフ。JST の1日に1回だけ生成する。
 * signals_brief/{JSTの日付} を Firestore トランザクションでロックし
 * （digest と同じ方式）、同時アクセスでも AI 呼び出しは1本に絞る。
 * 生成中・失敗時は前日のブリーフがあればそれを data に添える。
 */
async function getHandler(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json(ok<BriefPayload>(null));
  }

  const db = await getSignalsDb();
  if (!db) {
    // ロックできない環境では生成しない（リクエストのたびに課金が走るのを防ぐ）
    return NextResponse.json(fail<BriefPayload>(SIGNAL_NOT_CONFIGURED_MESSAGE));
  }

  const dateId = todayId();
  const docRef = db.collection(BRIEF_COLLECTION).doc(dateId);
  const apiKey = getOpenRouterApiKey();

  const readFallback = async (): Promise<BriefPayload | null> => {
    try {
      const snapshot = await db
        .collection(BRIEF_COLLECTION)
        .doc(previousDayId(dateId))
        .get();
      return toBriefPayload(snapshot.data() as BriefDocState | undefined);
    } catch {
      return null;
    }
  };
  const failWithFallback = async (message: string) => {
    const fallback = await readFallback();
    return NextResponse.json(
      fail<BriefPayload>(message, fallback?.generatedAt, fallback)
    );
  };

  let decision: BriefGenerationDecision;
  let ready: BriefPayload | null = null;
  try {
    decision = await db.runTransaction(async tx => {
      const snapshot = await tx.get(docRef);
      const state = snapshot.data() as BriefDocState | undefined;
      const result = decideBriefGeneration(state, Date.now(), apiKey !== null);
      if (result.kind === "ready") {
        ready = toBriefPayload(state);
      } else if (result.kind === "acquire") {
        tx.set(
          docRef,
          {
            dateId,
            status: "generating",
            attempts: result.attempts,
            lockedAtMs: Date.now(),
          },
          { merge: true }
        );
      }
      return result;
    });
  } catch (error) {
    logSignalError("claude-brief: 生成権の取得に失敗しました", error);
    return failWithFallback(BRIEF_UNAVAILABLE_MESSAGE);
  }

  switch (decision.kind) {
    case "ready": {
      const payload = ready as BriefPayload | null;
      return NextResponse.json(ok(payload, payload?.generatedAt));
    }
    case "generating":
      return failWithFallback(BRIEF_GENERATING_MESSAGE);
    case "exhausted":
      return failWithFallback(BRIEF_UNAVAILABLE_MESSAGE);
    case "unconfigured":
      console.error("claude-brief: OpenRouter APIキーが未設定のため生成しません");
      return failWithFallback(SIGNAL_NOT_CONFIGURED_MESSAGE);
  }

  const attempts = decision.attempts;
  try {
    let sources = await readBriefSources();
    if (!hasBriefSourceData(sources)) {
      sources = await refreshBriefSources(request.nextUrl.origin);
    }
    if (!hasBriefSourceData(sources)) {
      // AIを呼んでいないので、試行回数は消費させずにロックだけ外す
      await docRef.set(
        { dateId, status: "error", attempts: attempts - 1, lockedAtMs: 0 },
        { merge: true }
      );
      console.warn("claude-brief: 市場シグナルが未取得のため生成を見送りました");
      return failWithFallback(BRIEF_UNAVAILABLE_MESSAGE);
    }

    const brief = await callOpenRouterJson(
      apiKey!,
      buildMorningBriefPrompt(sources),
      claudeMorningBriefSchema
    );
    const payload: BriefPayload = { brief, generatedAt: new Date().toISOString() };
    await docRef.set(
      { ...payload, dateId, status: "ready", attempts, lockedAtMs: 0 },
      { merge: true }
    );
    return NextResponse.json(ok(payload, payload.generatedAt));
  } catch (error) {
    logSignalError("claude-brief: 朝ブリーフの生成に失敗しました", error);
    try {
      await docRef.set(
        { dateId, status: "error", attempts, lockedAtMs: 0 },
        { merge: true }
      );
    } catch (saveError) {
      logSignalError("claude-brief: error状態の保存にも失敗しました", saveError);
    }
    return failWithFallback(BRIEF_UNAVAILABLE_MESSAGE);
  }
}

/**
 * POST: 深掘り分析（プレミアム限定・1日10回まで）。
 * 回数はトランザクションで先に確保し、AI呼び出しが失敗したら返却する
 * （確認と加算の間に AI 呼び出しを挟むと、並列リクエストで上限をすり抜ける）。
 */
async function postHandler(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json(
      fail<ClaudeDeepDive>("静的エクスポートでは深掘り分析は利用できません")
    );
  }

  const authResult = await verifyAuth(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const body = await request.json().catch(() => null);
  const parsed = claudeDeepDiveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      fail<ClaudeDeepDive>("リクエストの形式が正しくありません"),
      { status: 400 }
    );
  }

  const uid = authResult.uid;
  try {
    const db = await getSignalsDb();
    const sub = db ? await db.collection("subscriptions").doc(uid).get() : null;
    if (!db || !isSubscriptionPremium(sub?.data())) {
      return NextResponse.json(
        fail<ClaudeDeepDive>("プレミアムユーザーのみ利用できます")
      );
    }

    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
      console.error("claude-brief(POST): OpenRouter APIキーが未設定です");
      return NextResponse.json(fail<ClaudeDeepDive>(SIGNAL_NOT_CONFIGURED_MESSAGE));
    }

    const { FieldValue } = await import("firebase-admin/firestore");
    const dateId = todayId();
    const usageRef = db
      .collection("signals_claude_usage")
      .doc(`${uid}_${dateId}`);
    const reserved = await db.runTransaction(async tx => {
      const snapshot = await tx.get(usageRef);
      const count = Number(snapshot.data()?.count ?? 0);
      if (count >= MAX_DEEP_DIVES_PER_DAY) return false;
      tx.set(
        usageRef,
        {
          userId: uid,
          date: dateId,
          count: count + 1,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return true;
    });
    if (!reserved) {
      return NextResponse.json(
        fail<ClaudeDeepDive>("本日の深掘り分析上限に達しました")
      );
    }

    try {
      const deepDive = await callOpenRouterJson(
        apiKey,
        buildDeepDivePrompt(parsed.data),
        claudeDeepDiveSchema
      );
      return NextResponse.json(ok(deepDive, new Date().toISOString()));
    } catch (error) {
      // 失敗した分は回数に数えない
      await usageRef
        .set({ count: FieldValue.increment(-1) }, { merge: true })
        .catch(releaseError =>
          logSignalError("claude-brief(POST): 回数の返却に失敗しました", releaseError)
        );
      throw error;
    }
  } catch (error) {
    logSignalError(
      `claude-brief(POST): 深掘り分析に失敗しました (user=${maskId(uid)})`,
      error
    );
    return NextResponse.json(fail<ClaudeDeepDive>(DEEP_DIVE_FAILED_MESSAGE));
  }
}

export const GET = withRateLimit(getHandler);
export const POST = withRateLimit(postHandler);
