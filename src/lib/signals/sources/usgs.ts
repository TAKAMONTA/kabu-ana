export interface EarthquakeSignal {
  id: string;
  magnitude: number;
  place: string;
  time: string;
  url: string;
  depthKm: number | null;
}

const USGS_WEEK_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson";

export function parseUsgsEarthquakes(payload: any): EarthquakeSignal[] {
  const features = payload?.features;
  if (!Array.isArray(features)) return [];
  return features
    .map((feature) => ({
      id: String(feature.id ?? feature.properties?.code ?? ""),
      magnitude: Number(feature.properties?.mag ?? 0),
      place: String(feature.properties?.place ?? "不明"),
      time: new Date(Number(feature.properties?.time ?? 0)).toISOString(),
      url: String(feature.properties?.url ?? ""),
      depthKm: Array.isArray(feature.geometry?.coordinates) ? Number(feature.geometry.coordinates[2]) : null,
    }))
    .filter((item) => item.id && Number.isFinite(item.magnitude))
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

export async function fetchUsgsEarthquakes(): Promise<EarthquakeSignal[]> {
  const response = await fetch(USGS_WEEK_URL, { next: { revalidate: 180 } });
  if (!response.ok) throw new Error(`USGS failed: ${response.status}`);
  return parseUsgsEarthquakes(await response.json());
}
