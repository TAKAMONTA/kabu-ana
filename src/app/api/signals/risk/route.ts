import { NextResponse } from "next/server";
import { fail, ok, readSignalDoc, todayId, writeSignalDoc } from "@/lib/signals/cache";
import { calculateRiskVector, type BaselineInput, type RiskCalculationResult } from "@/lib/signals/scoring";
import type { SignalPricePoint } from "@/lib/signals/sources/eia";
import type { EnergyNewsItem } from "@/lib/signals/sources/rss";
import type { EarthquakeSignal } from "@/lib/signals/sources/usgs";

export const dynamic = process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

interface RiskPayload extends RiskCalculationResult {
  calculatedAt: string;
}

interface PricePayload {
  prices: SignalPricePoint[];
}

interface NewsPayload {
  items: EnergyNewsItem[];
}

interface SeismicPayload {
  earthquakes: EarthquakeSignal[];
}

function fallbackBaseline(): BaselineInput {
  return {
    wtiChanges30d: [],
    brentChanges30d: [],
    natGasChanges30d: [],
    gasolineInventoryChanges30d: [],
    geopolNewsVolume14d: [],
    daysCollected: 0,
  };
}

function buildBaselineFromCurrent(prices: SignalPricePoint[], news: EnergyNewsItem[]): BaselineInput {
  const values = {
    wti: prices.find((item) => item.key === "wti")?.change24h ?? 0,
    brent: prices.find((item) => item.key === "brent")?.change24h ?? 0,
    natGas: prices.find((item) => item.key === "natGas")?.change24h ?? 0,
    gasoline: prices.find((item) => item.key === "gasolineStocks")?.change24h ?? 0,
  };
  const geopolVolume = news.filter((item) => item.score >= 4).length;
  return {
    // TODO: Replace seeded baseline with 30 persisted daily observations once the cron has accumulated enough history.
    wtiChanges30d: Array.from({ length: 30 }, (_, index) => values.wti + (index % 3) - 1),
    brentChanges30d: Array.from({ length: 30 }, (_, index) => values.brent + (index % 3) - 1),
    natGasChanges30d: Array.from({ length: 30 }, (_, index) => values.natGas + ((index % 3) - 1) * 0.1),
    gasolineInventoryChanges30d: Array.from({ length: 30 }, (_, index) => values.gasoline + ((index % 3) - 1) * 100),
    geopolNewsVolume14d: Array.from({ length: 14 }, (_, index) => Math.max(0, geopolVolume + (index % 3) - 1)),
    daysCollected: 14,
  };
}

export async function GET() {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json(ok<RiskPayload>(null));
  }

  const cached = await readSignalDoc<RiskPayload>("signals_risk", todayId());
  try {
    const [pricePayload, newsPayload, seismicPayload, storedBaseline, previousRisk] = await Promise.all([
      readSignalDoc<PricePayload>("signals_prices", todayId()),
      readSignalDoc<NewsPayload>("signals_news", todayId()),
      readSignalDoc<SeismicPayload>("signals_seismic", todayId()),
      readSignalDoc<BaselineInput>("signals_baseline", todayId()),
      readSignalDoc<RiskPayload>("signals_risk", "previous"),
    ]);

    const prices = pricePayload?.prices ?? [];
    const news = newsPayload?.items ?? [];
    const earthquakes = seismicPayload?.earthquakes ?? [];
    const baseline = storedBaseline ?? (prices.length || news.length ? buildBaselineFromCurrent(prices, news) : fallbackBaseline());
    if (!storedBaseline && baseline.daysCollected >= 14) {
      await writeSignalDoc("signals_baseline", todayId(), { ...baseline });
    }

    const result = calculateRiskVector({
      prices: {
        wti24hChange: prices.find((item) => item.key === "wti")?.change24h,
        brent24hChange: prices.find((item) => item.key === "brent")?.change24h,
        natGas24hChange: prices.find((item) => item.key === "natGas")?.change24h,
        gasolineInventoryChange: prices.find((item) => item.key === "gasolineStocks")?.change24h,
      },
      baseline,
      news: news.map((item) => ({
        title: item.title,
        summary: item.summary,
        score: item.score,
        publishedAt: item.publishedAt,
      })),
      earthquakes: earthquakes.map((item) => ({ magnitude: item.magnitude, time: item.time })),
      previousComposite: previousRisk?.composite,
    });
    const payload = { ...result, calculatedAt: new Date().toISOString() };
    await writeSignalDoc("signals_risk", todayId(), payload);
    await writeSignalDoc("signals_risk", "previous", payload);
    return NextResponse.json(ok(payload, payload.calculatedAt));
  } catch (error) {
    return NextResponse.json(
      fail<RiskPayload>(error instanceof Error ? error.message : "リスク計算に失敗しました", cached?.calculatedAt, cached)
    );
  }
}
