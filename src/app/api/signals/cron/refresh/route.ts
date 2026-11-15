import { NextRequest, NextResponse } from "next/server";
import { logSignalError, ok, writeSignalDoc } from "@/lib/signals/cache";
import { SIGNAL_REFRESH_GROUPS } from "@/lib/signals/refreshPlan";
import { isAuthorizedCronRequest } from "@/lib/signals/cronAuth";

export const dynamic = "force-dynamic";

/** 内部のシグナルAPI 1本あたりのタイムアウト */
const INTERNAL_CALL_TIMEOUT_MS = 60_000;

async function callInternal(path: string, origin: string) {
  try {
    const response = await fetch(`${origin}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(INTERNAL_CALL_TIMEOUT_MS),
    });
    return {
      path,
      status: response.status,
      body: await response.json().catch(() => null),
    };
  } catch (error) {
    logSignalError(`signals/cron: ${path} の呼び出しに失敗しました`, error);
    return { path, status: 0, body: null };
  }
}

/**
 * Vercel Cron（vercel.json の crons）から毎日呼ばれる。
 * Vercel は環境変数 CRON_SECRET の値を `Authorization: Bearer <CRON_SECRET>` として送る
 * （https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs）。
 * 旧名 SIGNALS_CRON_SECRET も互換のため受け付ける。
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("Authorization"))) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const startedAt = Date.now();
  const origin = request.nextUrl.origin;
  const results = [];
  for (const group of SIGNAL_REFRESH_GROUPS) {
    results.push(
      ...(await Promise.all(group.map(path => callInternal(path, origin))))
    );
  }
  const payload = {
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    results,
  };
  await writeSignalDoc("signals_run_log", `${Date.now()}`, payload).catch(
    error => logSignalError("signals/cron: 実行ログの保存に失敗しました", error)
  );
  return NextResponse.json(ok(payload, payload.ranAt));
}
