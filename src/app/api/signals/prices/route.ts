import { NextResponse } from "next/server";
import {
  fail,
  logSignalError,
  ok,
  readSignalDocWithFallback,
  SIGNAL_FETCH_FAILED_MESSAGE,
  SIGNAL_NOT_CONFIGURED_MESSAGE,
  todayId,
  writeSignalDocWithFallback,
} from "@/lib/signals/cache";
import { fetchEiaPriceStrip, type SignalPricePoint } from "@/lib/signals/sources/eia";
import { fetchFredPriceStrip } from "@/lib/signals/sources/fred";

export const dynamic = "force-dynamic";

interface PriceStripPayload {
  prices: SignalPricePoint[];
  fetchedAt: string;
}

export async function GET() {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json(ok<PriceStripPayload>(null));
  }

  const cached = await readSignalDocWithFallback<PriceStripPayload>(
    "signals_prices",
    todayId()
  ).catch(() => null);
  try {
    const eiaKey = process.env.EIA_API_KEY;
    const fredKey = process.env.FRED_API_KEY;
    if (!eiaKey || !fredKey) {
      // どのキーが無いかはログにだけ出す（応答に環境変数名を載せない）
      console.error(
        `signals/prices: APIキーが未設定です (EIA=${Boolean(eiaKey)}, FRED=${Boolean(fredKey)})`
      );
      return NextResponse.json(
        fail<PriceStripPayload>(SIGNAL_NOT_CONFIGURED_MESSAGE, cached?.fetchedAt, cached)
      );
    }

    const [eia, fred] = await Promise.all([fetchEiaPriceStrip(eiaKey), fetchFredPriceStrip(fredKey)]);
    const payload = { prices: [...eia, ...fred], fetchedAt: new Date().toISOString() };
    await writeSignalDocWithFallback("signals_prices", todayId(), payload);
    return NextResponse.json(ok(payload, payload.fetchedAt), {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=900" },
    });
  } catch (error) {
    logSignalError("signals/prices: 価格取得に失敗しました", error);
    return NextResponse.json(
      fail<PriceStripPayload>(SIGNAL_FETCH_FAILED_MESSAGE, cached?.fetchedAt, cached)
    );
  }
}
