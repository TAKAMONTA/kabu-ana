export interface PulsePricePoint {
  key?: string;
  value?: unknown;
  change24h?: unknown;
}

export interface PulseNewsItem {
  label?: string;
}

export interface PulseData {
  wti: { value: number | null; change24h: number | null } | null;
  hotCount: number;
  criticalCount: number;
}

export function derivePulse(
  prices: PulsePricePoint[],
  items: PulseNewsItem[]
): PulseData {
  const wti = prices.find(p => p?.key === "wti");
  const hotCount = items.filter(
    i => i?.label === "Hot" || i?.label === "Critical"
  ).length;
  const criticalCount = items.filter(i => i?.label === "Critical").length;

  return {
    wti: wti
      ? {
          value: typeof wti.value === "number" ? wti.value : null,
          change24h: typeof wti.change24h === "number" ? wti.change24h : null,
        }
      : null,
    hotCount,
    criticalCount,
  };
}
