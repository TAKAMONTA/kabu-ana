"use client";

import { useSignalApi } from "./useSignalApi";
import type { EnergyNewsItem } from "@/lib/signals/sources/rss";

export interface EnergyNewsPayload {
  items: EnergyNewsItem[];
  fetchedAt: string;
}

export function useEnergyNews() {
  return useSignalApi<EnergyNewsPayload>("/api/signals/news");
}
