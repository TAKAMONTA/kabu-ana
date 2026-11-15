import { NextResponse } from "next/server";
import {
  fail,
  logSignalError,
  ok,
  readSignalDocWithFallback,
  SIGNAL_FETCH_FAILED_MESSAGE,
  todayId,
  writeSignalDocWithFallback,
} from "@/lib/signals/cache";
import { fetchUsgsEarthquakes, type EarthquakeSignal } from "@/lib/signals/sources/usgs";

export const dynamic = "force-dynamic";

interface SeismicPayload {
  earthquakes: EarthquakeSignal[];
  fetchedAt: string;
}

export async function GET() {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json(ok<SeismicPayload>(null));
  }

  const cached = await readSignalDocWithFallback<SeismicPayload>(
    "signals_seismic",
    todayId()
  ).catch(() => null);
  try {
    const earthquakes = await fetchUsgsEarthquakes();
    const payload = { earthquakes, fetchedAt: new Date().toISOString() };
    await writeSignalDocWithFallback("signals_seismic", todayId(), payload);
    return NextResponse.json(ok(payload, payload.fetchedAt), {
      headers: { "Cache-Control": "s-maxage=180, stale-while-revalidate=600" },
    });
  } catch (error) {
    logSignalError("signals/seismic: 地震データ取得に失敗しました", error);
    return NextResponse.json(
      fail<SeismicPayload>(SIGNAL_FETCH_FAILED_MESSAGE, cached?.fetchedAt, cached)
    );
  }
}
