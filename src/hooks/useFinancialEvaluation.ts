"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FinancialEvaluationResult } from "@/lib/api/openrouter";
import { getApiUrl, getAuthHeaders } from "@/lib/utils/apiClient";
import { CapacitorHttp } from "@capacitor/core";

export function useFinancialEvaluation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinancialEvaluationResult | null>(null);
  const lastArgsRef = useRef<{
    symbol: string;
    companyName: string;
    financialData?: any;
    edinetExtras?: {
      ratios?: any;
      financialHistory?: any[] | null;
      accountingStandard?: string | null;
    };
  } | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const evaluate = useCallback(
    async (
      args: {
        symbol: string;
        companyName: string;
        financialData?: any;
        edinetExtras?: {
          ratios?: any;
          financialHistory?: any[] | null;
          accountingStandard?: string | null;
        };
      },
      options?: { bundleToken?: string }
    ) => {
      lastArgsRef.current = args;
      setIsLoading(true);
      setError(null);
      try {
        const headers = await getAuthHeaders();
        if (options?.bundleToken) {
          headers["X-AI-Bundle-Token"] = options.bundleToken;
        }
        const requestOptions = {
          url: getApiUrl("/api/financial-evaluation"),
          headers,
          data: args,
        };
        const response = await CapacitorHttp.post(requestOptions);
        const data = response.data;
        if (response.status !== 200)
          throw new Error(data.error || "財務評価に失敗しました");
        if (!mountedRef.current) return;
        setResult(data.analysis);
      } catch (e: any) {
        if (!mountedRef.current) return;
        setError(e.message || "財務評価に失敗しました");
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    },
    []
  );

  const retry = useCallback(() => {
    if (lastArgsRef.current) {
      evaluate(lastArgsRef.current);
    }
  }, [evaluate]);

  const clear = useCallback(() => setResult(null), []);

  return { isLoading, error, result, evaluate, clear, retry } as const;
}
