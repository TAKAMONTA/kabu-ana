import { NextResponse } from "next/server";
import {
  fail,
  ok,
  readSignalDocWithFallback,
  todayId,
  writeSignalDocWithFallback,
} from "@/lib/signals/cache";
import { fetchEiaPriceStrip, type SignalPricePoint } from "@/lib/signals/sources/eia";
import { fetchFredPriceStrip } from "@/lib/signals/sources/fred";

export const dynamic = process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

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
  );
  try {
    const eiaKey = process.env.EIA_API_KEY;
    const fredKey = process.env.FRED_API_KEY;
    if (!eiaKey || !fredKey) {
      return NextResponse.json(fail<PriceStripPayload>("EIA_API_KEY または FRED_API_KEY が未設定です", cached?.fetchedAt, cached));
    }

    const [eia, fred] = await Promise.all([fetchEiaPriceStrip(eiaKey), fetchFredPriceStrip(fredKey)]);
    const payload = { prices: [...eia, ...fred], fetchedAt: new Date().toISOString() };
    await writeSignalDocWithFallback("signals_prices", todayId(), payload);
    return NextResponse.json(ok(payload, payload.fetchedAt), {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=900" },
    });
  } catch (error) {
    return NextResponse.json(
      fail<PriceStripPayload>(error instanceof Error ? error.message : "価格取得に失敗しました", cached?.fetchedAt, cached)
    );
  }
}
