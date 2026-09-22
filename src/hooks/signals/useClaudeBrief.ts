"use client";

import { useCallback, useState } from "react";
import { CapacitorHttp } from "@capacitor/core";
import { getApiUrl, getAuthHeaders } from "@/lib/utils/apiClient";
import { useSignalApi } from "./useSignalApi";
import { unwrapSignalResponse } from "./unwrapSignalResponse";
import type { ClaudeDeepDive, ClaudeMorningBrief } from "@/lib/signals/claude";

export interface ClaudeBriefPayload {
  brief: ClaudeMorningBrief;
  generatedAt: string;
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
      setDeepDive(
        unwrapSignalResponse<ClaudeDeepDive>(response.status, response.data)
      );
    } catch (err) {
      setDeepDiveError(
        err instanceof Error ? err.message : "深掘り分析に失敗しました"
      );
    } finally {
      setIsDeepDiveLoading(false);
    }
  }, []);

  return {
    ...brief,
    deepDive,
    deepDiveError,
    isDeepDiveLoading,
    requestDeepDive,
  };
}
