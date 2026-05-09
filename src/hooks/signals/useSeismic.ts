"use client";

import { useSignalApi } from "./useSignalApi";
import type { EarthquakeSignal } from "@/lib/signals/sources/usgs";

export interface SeismicPayload {
  earthquakes: EarthquakeSignal[];
  fetchedAt: string;
}

export function useSeismic() {
  return useSignalApi<SeismicPayload>("/api/signals/seismic");
}
