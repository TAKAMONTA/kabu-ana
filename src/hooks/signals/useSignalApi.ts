"use client";

import { useCallback, useEffect, useState } from "react";
import { CapacitorHttp } from "@capacitor/core";
import { getApiUrl, getAuthHeaders } from "@/lib/utils/apiClient";

interface SignalApiResponse<T> {
  data: T | null;
  error?: string;
  lastSuccessfulAt?: string;
}

function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (
    window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
  ).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

async function fetchSignal<T>(endpoint: string): Promise<SignalApiResponse<T>> {
  const url = getApiUrl(endpoint);
  const headers = await getAuthHeaders();

  if (isCapacitorNative()) {
    const response = await CapacitorHttp.get({ url, headers });
    return response.data as SignalApiResponse<T>;
  }

  const response = await fetch(url, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as SignalApiResponse<T>;
}

export function useSignalApi<T>(
  endpoint: string,
  options?: { immediate?: boolean }
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSuccessfulAt, setLastSuccessfulAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(options?.immediate !== false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const body = await fetchSignal<T>(endpoint);
      setData(body.data);
      setLastSuccessfulAt(body.lastSuccessfulAt ?? null);
      setError(body.error ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "データ取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (options?.immediate !== false) refresh();
  }, [options?.immediate, refresh]);

  return { data, error, isLoading, lastSuccessfulAt, refresh };
}
