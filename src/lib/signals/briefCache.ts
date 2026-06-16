export interface BriefSourceInput {
  prices?: { fetchedAt?: string | null; prices?: unknown[] | null } | null;
  news?: { fetchedAt?: string | null; items?: unknown[] | null } | null;
  seismic?: {
    fetchedAt?: string | null;
    earthquakes?: unknown[] | null;
  } | null;
  risk?: {
    calculatedAt?: string | null;
    risk?: unknown | null;
    composite?: unknown | null;
    anomalies?: unknown[] | null;
  } | null;
}

export interface BriefCacheInput {
  generatedAt?: string | null;
}

function latestIso(values: Array<string | null | undefined>): string | null {
  const timestamps = values
    .map(value => (value ? Date.parse(value) : NaN))
    .filter(Number.isFinite);
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

export function getLatestBriefSourceAt(input: BriefSourceInput): string | null {
  return latestIso([
    input.prices?.fetchedAt,
    input.news?.fetchedAt,
    input.seismic?.fetchedAt,
    input.risk?.calculatedAt,
  ]);
}

export function shouldUseCachedBrief(
  cached: BriefCacheInput | null | undefined,
  input: BriefSourceInput
): boolean {
  if (!cached?.generatedAt) return false;
  const latestSourceAt = getLatestBriefSourceAt(input);
  if (!latestSourceAt) return true;
  return Date.parse(cached.generatedAt) >= Date.parse(latestSourceAt);
}

export function hasBriefSourceData(input: BriefSourceInput): boolean {
  return Boolean(
    (input.prices?.prices?.length ?? 0) > 0 ||
    (input.news?.items?.length ?? 0) > 0 ||
    (input.seismic?.earthquakes?.length ?? 0) > 0 ||
    input.risk?.risk != null ||
    input.risk?.composite != null ||
    (input.risk?.anomalies?.length ?? 0) > 0
  );
}
