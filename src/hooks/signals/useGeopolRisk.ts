"use client";

import { useSignalApi } from "./useSignalApi";
import type { RiskVector } from "@/lib/signals/scoring";

export interface GeopolRiskPayload {
  risk: RiskVector | null;
  composite: number | null;
  anomalies: Array<{ label: string; score: number; reason: string }>;
  baselineReady: boolean;
  calculatedAt: string;
}

export function useGeopolRisk() {
  return useSignalApi<GeopolRiskPayload>("/api/signals/risk");
}
