"use client";

import { useCallback, useState } from "react";
import { CapacitorHttp } from "@capacitor/core";
import { getApiUrl, getAuthHeaders } from "@/lib/utils/apiClient";
import { useSignalApi } from "./useSignalApi";
import type { ClaudeDeepDive, ClaudeMorningBrief } from "@/lib/signals/claude";

export interface ClaudeBriefPayload {
  brief: ClaudeMorningBrief;
  generatedAt: string;
}

interface SignalApiResponse<T> {
  data: T | null;
  error?: string;
}

export function useClaudeBrief() {
  const brief = useSignalApi<ClaudeBriefPayload>("/api/signals/claude-brief");
  const [deepDive, setDeepDive] = useState<ClaudeDeepDive | null>(null);
  const [deepDiveError, setDeepDiveError] = useState<string | null>(null);
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);

  const requestDeepDive = useCallback(async (signal: unknown) => {
    setIsDeepDiveLoading(true);
    setDeepDiveError(null);
    try {
      const response = await CapacitorHttp.post({
        url: getApiUrl("/api/signals/claude-brief"),
        headers: await getAuthHeaders(),
        data: signal,
      });
      const body = response.data as SignalApiResponse<ClaudeDeepDive>;
      if (body.error) throw new Error(body.error);
      setDeepDive(body.data);
    } catch (err) {
      setDeepDiveError(err instanceof Error ? err.message : "深掘り分析に失敗しました");
    } finally {
      setIsDeepDiveLoading(false);
    }
  }, []);

  return { ...brief, deepDive, deepDiveError, isDeepDiveLoading, requestDeepDive };
}
