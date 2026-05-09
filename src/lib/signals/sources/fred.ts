import type { SignalPricePoint } from "./eia";

export interface FredObservation {
  date: string;
  value: string;
}

const FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations";

const FRED_SERIES = [
  { key: "vix", label: "VIX", seriesId: "VIXCLS", unit: "pt" },
  { key: "usdIndex", label: "USD指数", seriesId: "DTWEXBGS", unit: "pt" },
  { key: "us10y", label: "米10年金利", seriesId: "DGS10", unit: "%" },
];

export function parseFredObservations(payload: any): FredObservation[] {
  const observations = payload?.observations;
  if (!Array.isArray(observations)) return [];
  return observations.filter((item) => item?.value && item.value !== ".");
}

export function latestFredPricePoint(
  key: string,
  label: string,
  unit: string,
  observations: FredObservation[]
): SignalPricePoint {
  const sorted = observations
    .map((item) => ({ period: item.date, value: Number(item.value) }))
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => b.period.localeCompare(a.period));
  const latest = sorted[0];
  const previous = sorted[1];
  return {
    key,
    label,
    value: latest?.value ?? null,
    unit,
    period: latest?.period ?? null,
    change24h: latest && previous ? latest.value - previous.value : null,
    source: "FRED",
  };
}

export async function fetchFredPriceStrip(apiKey: string): Promise<SignalPricePoint[]> {
  return Promise.all(
    FRED_SERIES.map(async (series) => {
      const url = new URL(FRED_BASE_URL);
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("file_type", "json");
      url.searchParams.set("series_id", series.seriesId);
      url.searchParams.set("sort_order", "desc");
      url.searchParams.set("limit", "2");
      const response = await fetch(url);
      if (!response.ok) throw new Error(`FRED ${series.key} failed: ${response.status}`);
      return latestFredPricePoint(series.key, series.label, series.unit, parseFredObservations(await response.json()));
    })
  );
}
