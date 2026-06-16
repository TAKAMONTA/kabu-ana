import axios from "axios";
import { NextRequest, NextResponse } from "next/server";
import { OpenRouterClient, type OpenRouterResponse } from "@/lib/api/openrouter";
import { isAuthError, verifyAuth } from "@/lib/auth/verifyAuth";
import { fail, getSignalsDb, ok, readSignalDoc, todayId, writeSignalDoc } from "@/lib/signals/cache";
import {
  buildDeepDivePrompt,
  buildMorningBriefPrompt,
  claudeDeepDiveSchema,
  claudeMorningBriefSchema,
  extractJsonObject,
  type ClaudeDeepDive,
  type ClaudeMorningBrief,
} from "@/lib/signals/claude";

export const dynamic = process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

interface BriefPayload {
  brief: ClaudeMorningBrief;
  generatedAt: string;
}

async function callOpenRouterJson<T>(prompt: string, schema: { parse: (value: unknown) => T }): Promise<T> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === "your_openrouter_api_key_here" || apiKey === "your_openrouter_key_here") {
    throw new Error("OPENROUTER_API_KEYが設定されていません");
  }
  const client = new OpenRouterClient(apiKey) as unknown as { baseURL: string; apiKey: string };
  const response = await axios.post(
    `${client.baseURL}/chat/completions`,
    {
      model: "anthropic/claude-sonnet-4-5",
      messages: [
        { role: "system", content: "あなたは日本株市場向けの地政学・エネルギー市場アナリストです。回答はJSONのみです。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1800,
    },
    {
      headers: {
        Authorization: `Bearer ${client.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://kabu-ana.com",
        "X-Title": "AI Market Analyzer",
      },
      timeout: 30000,
    }
  );
  const data: OpenRouterResponse = response.data;
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("Claude応答が空です");
  return schema.parse(extractJsonObject(content));
}

export async function GET() {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json(ok<BriefPayload>(null));
  }
  const cached = await readSignalDoc<BriefPayload>("signals_brief", todayId());
  const cachedGeneratedAt = cached?.generatedAt;
  if (cached) return NextResponse.json(ok(cached, cached.generatedAt));

  try {
    const [prices, news, seismic, risk] = await Promise.all([
      readSignalDoc("signals_prices", todayId()),
      readSignalDoc("signals_news", todayId()),
      readSignalDoc("signals_seismic", todayId()),
      readSignalDoc("signals_risk", todayId()),
    ]);
    const brief = await callOpenRouterJson(
      buildMorningBriefPrompt({ prices, news, seismic, risk }),
      claudeMorningBriefSchema
    );
    const payload = { brief, generatedAt: new Date().toISOString() };
    await writeSignalDoc("signals_brief", todayId(), payload);
    return NextResponse.json(ok(payload, payload.generatedAt));
  } catch (error) {
    return NextResponse.json(
      fail<BriefPayload>(error instanceof Error ? error.message : "Claude朝サマリー生成に失敗しました", cachedGeneratedAt, cached)
    );
  }
}

export async function POST(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json(fail<ClaudeDeepDive>("静的エクスポートでは深掘り分析は利用できません"));
  }

  const authResult = await verifyAuth(request);
  if (isAuthError(authResult)) {
    return NextResponse.json(fail<ClaudeDeepDive>("深掘り分析にはログインが必要です"));
  }

  try {
    const db = await getSignalsDb();
    const sub = db ? await db.collection("subscriptions").doc(authResult.uid).get() : null;
    const subData = sub?.data();
    const isPremium = (subData?.status === "active" || subData?.status === "trial") && (!subData?.expiryDate || subData.expiryDate.toDate() > new Date());
    if (!isPremium) return NextResponse.json(fail<ClaudeDeepDive>("プレミアムユーザーのみ利用できます"));

    const dateId = todayId();
    const usageRef = db?.collection("signals_claude_usage").doc(`${authResult.uid}_${dateId}`);
    const usage = usageRef ? await usageRef.get() : null;
    const count = Number(usage?.data()?.count ?? 0);
    if (count >= 10) return NextResponse.json(fail<ClaudeDeepDive>("本日の深掘り分析上限に達しました"));

    const body = await request.json();
    const deepDive = await callOpenRouterJson(buildDeepDivePrompt(body), claudeDeepDiveSchema);
    if (usageRef) {
      const { FieldValue } = await import("firebase-admin/firestore");
      await usageRef.set({ userId: authResult.uid, date: dateId, count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    return NextResponse.json(ok(deepDive, new Date().toISOString()));
  } catch (error) {
    return NextResponse.json(
      fail<ClaudeDeepDive>(error instanceof Error ? error.message : "深掘り分析に失敗しました")
    );
  }
}
