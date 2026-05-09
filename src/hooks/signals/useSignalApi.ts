"use client";

import { useCallback, useEffect, useState } from "react";
import { CapacitorHttp } from "@capacitor/core";
import { getApiUrl, getAuthHeaders } from "@/lib/utils/apiClient";

interface SignalApiResponse<T> {
  data: T | null;
  error?: string;
  lastSuccessfulAt?: string;
}

export function useSignalApi<T>(endpoint: string, options?: { immediate?: boolean }) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSuccessfulAt, setLastSuccessfulAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(options?.immediate !== false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await CapacitorHttp.get({
        url: getApiUrl(endpoint),
        headers: await getAuthHeaders(),
      });
      const body = response.data as SignalApiResponse<T>;
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
