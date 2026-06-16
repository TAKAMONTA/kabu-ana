import { NextRequest, NextResponse } from "next/server";
import { ok, writeSignalDoc } from "@/lib/signals/cache";
import { SIGNAL_REFRESH_GROUPS } from "@/lib/signals/refreshPlan";

export const dynamic =
  process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

async function callInternal(path: string, origin: string) {
  const response = await fetch(`${origin}${path}`, { cache: "no-store" });
  return {
    path,
    status: response.status,
    body: await response.json().catch(() => null),
  };
}

export async function GET(request: NextRequest) {
  const secret = process.env.SIGNALS_CRON_SECRET;
  const auth = request.headers.get("Authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
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
  await writeSignalDoc("signals_run_log", `${Date.now()}`, payload);
  return NextResponse.json(ok(payload, payload.ranAt));
}
