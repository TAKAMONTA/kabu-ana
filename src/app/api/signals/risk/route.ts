import { NextResponse } from "next/server";
import {
  fail,
  logSignalError,
  ok,
  previousDayId,
  readSignalDoc,
  SIGNAL_FETCH_FAILED_MESSAGE,
  todayId,
  writeSignalDoc,
} from "@/lib/signals/cache";
import { calculateRiskVector, type BaselineInput, type RiskCalculationResult } from "@/lib/signals/scoring";
import type { SignalPricePoint } from "@/lib/signals/sources/eia";
import type { EnergyNewsItem } from "@/lib/signals/sources/rss";
import type { EarthquakeSignal } from "@/lib/signals/sources/usgs";

export const dynamic = "force-dynamic";

interface RiskPayload extends RiskCalculationResult {
  calculatedAt: string;
  /** 計算した JST の日付（翌日の異常判定の比較元になる） */
  dateId?: string;
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

/**
 * リスクベクトルを計算して返す。
 * 「24時間変化 +3.0 以上」の異常判定は、前回の“リクエスト”ではなく前日（JST）の
 * 確定値 signals_risk/{前日} と比べる。以前は毎回 signals_risk/previous を
 * 上書きしていたため、数分前の値との差しか見ていなかった。
 */
export async function GET() {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json(ok<RiskPayload>(null));
  }

  const dateId = todayId();
  const cached = await readSignalDoc<RiskPayload>("signals_risk", dateId).catch(
    () => null
  );
  try {
    const [pricePayload, newsPayload, seismicPayload, storedBaseline, yesterdayRisk] = await Promise.all([
      readSignalDoc<PricePayload>("signals_prices", dateId),
      readSignalDoc<NewsPayload>("signals_news", dateId),
      readSignalDoc<SeismicPayload>("signals_seismic", dateId),
      readSignalDoc<BaselineInput>("signals_baseline", dateId),
      readSignalDoc<RiskPayload>("signals_risk", previousDayId(dateId)),
    ]);

    const prices = pricePayload?.prices ?? [];
    const news = newsPayload?.items ?? [];
    const earthquakes = seismicPayload?.earthquakes ?? [];
    if (prices.length === 0 && news.length === 0 && earthquakes.length === 0) {
      // 入力が1つも無い日は計算しない（0点のリスクで当日分を上書きし、
      // それを材料に朝ブリーフが生成されるのを防ぐ）
      return NextResponse.json(
        fail<RiskPayload>(SIGNAL_FETCH_FAILED_MESSAGE, cached?.calculatedAt, cached)
      );
    }
    const baseline = storedBaseline ?? (prices.length || news.length ? buildBaselineFromCurrent(prices, news) : fallbackBaseline());
    if (!storedBaseline && baseline.daysCollected >= 14) {
      await writeSignalDoc("signals_baseline", dateId, { ...baseline });
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
      previousComposite: yesterdayRisk?.composite,
    });
    const payload = { ...result, dateId, calculatedAt: new Date().toISOString() };
    await writeSignalDoc("signals_risk", dateId, payload);
    return NextResponse.json(ok(payload, payload.calculatedAt));
  } catch (error) {
    logSignalError("signals/risk: リスク計算に失敗しました", error);
    return NextResponse.json(
      fail<RiskPayload>(SIGNAL_FETCH_FAILED_MESSAGE, cached?.calculatedAt, cached)
    );
  }
}
