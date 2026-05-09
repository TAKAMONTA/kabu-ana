export interface SignalPricePoint {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  period: string | null;
  change24h: number | null;
  source: "EIA" | "FRED";
}

export interface EiaObservation {
  period?: string;
  value?: string | number | null;
}

const EIA_BASE_URL = "https://api.eia.gov/v2";

const EIA_SERIES = [
  { key: "wti", label: "WTI", route: "petroleum/pri/spt/data/", seriesId: "RWTC", unit: "USD/bbl", frequency: "daily" },
  { key: "brent", label: "Brent", route: "petroleum/pri/spt/data/", seriesId: "RBRTE", unit: "USD/bbl", frequency: "daily" },
  { key: "gasolineStocks", label: "米ガソリン在庫", route: "petroleum/stoc/wstk/data/", seriesId: "WGTSTUS1", unit: "Mbbl", frequency: "weekly" },
] as const;

export function parseEiaData(payload: any): EiaObservation[] {
  const data = payload?.response?.data;
  if (!Array.isArray(data)) return [];
  return data;
}

export function latestEiaPricePoint(
  key: string,
  label: string,
  unit: string,
  observations: EiaObservation[]
): SignalPricePoint {
  const sorted = observations
    .map((item) => ({ period: item.period ?? null, value: item.value == null ? null : Number(item.value) }))
    .filter((item) => item.period && Number.isFinite(item.value))
    .sort((a, b) => String(b.period).localeCompare(String(a.period)));
  const latest = sorted[0];
  const previous = sorted[1];
  const value = latest?.value ?? null;
  const previousValue = previous?.value ?? null;
  return {
    key,
    label,
    value,
    unit,
    period: latest?.period ?? null,
    change24h: value != null && previousValue != null ? value - previousValue : null,
    source: "EIA",
  };
}

export async function fetchEiaPriceStrip(apiKey: string): Promise<SignalPricePoint[]> {
  const points = await Promise.all(
    EIA_SERIES.map(async (series) => {
      const url = new URL(`${EIA_BASE_URL}/${series.route}`);
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("frequency", series.frequency);
      url.searchParams.set("data[0]", "value");
      url.searchParams.set("facets[series][]", series.seriesId);
      url.searchParams.set("sort[0][column]", "period");
      url.searchParams.set("sort[0][direction]", "desc");
      url.searchParams.set("length", "2");
      const response = await fetch(url);
      if (!response.ok) throw new Error(`EIA ${series.key} failed: ${response.status}`);
      return latestEiaPricePoint(series.key, series.label, series.unit, parseEiaData(await response.json()));
    })
  );

  // TODO: EIA Henry Hub futures facets vary by contract; use a public daily endpoint when the target contract is finalized.
  points.push({
    key: "natGas",
    label: "Henry Hub",
    value: null,
    unit: "USD/MMBtu",
    period: null,
    change24h: null,
    source: "EIA",
  });

  return points;
}
