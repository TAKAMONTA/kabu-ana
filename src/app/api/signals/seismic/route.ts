import { NextResponse } from "next/server";
import { fail, ok, readSignalDoc, todayId, writeSignalDoc } from "@/lib/signals/cache";
import { fetchUsgsEarthquakes, type EarthquakeSignal } from "@/lib/signals/sources/usgs";

export const dynamic = process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

interface SeismicPayload {
  earthquakes: EarthquakeSignal[];
  fetchedAt: string;
}

export async function GET() {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json(ok<SeismicPayload>(null));
  }

  const cached = await readSignalDoc<SeismicPayload>("signals_seismic", todayId());
  try {
    const earthquakes = await fetchUsgsEarthquakes();
    const payload = { earthquakes, fetchedAt: new Date().toISOString() };
    await writeSignalDoc("signals_seismic", todayId(), payload);
    return NextResponse.json(ok(payload, payload.fetchedAt), {
      headers: { "Cache-Control": "s-maxage=180, stale-while-revalidate=600" },
    });
  } catch (error) {
    return NextResponse.json(
      fail<SeismicPayload>(error instanceof Error ? error.message : "地震データ取得に失敗しました", cached?.fetchedAt, cached)
    );
  }
}
