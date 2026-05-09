"use client";

import { useSignalApi } from "./useSignalApi";
import type { SignalPricePoint } from "@/lib/signals/sources/eia";

export interface PriceStripPayload {
  prices: SignalPricePoint[];
  fetchedAt: string;
}

export function usePriceStrip() {
  return useSignalApi<PriceStripPayload>("/api/signals/prices");
}
