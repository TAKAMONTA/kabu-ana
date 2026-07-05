"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FinancialEvaluationResult } from "@/lib/api/openrouter";
import { getAuthHeaders, postJson } from "@/lib/utils/apiClient";

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
    mountedRef.current = true;
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
        const response = await postJson<{ analysis: FinancialEvaluationResult; error?: string }>(
          "/api/financial-evaluation",
          args,
          headers
        );
        if (response.status !== 200) {
          throw new Error(response.data.error || "財務評価に失敗しました");
        }
        if (!mountedRef.current) return;
        setResult(response.data.analysis);
      } catch (e: any) {
        if (!mountedRef.current) return;
        setError(e.message || "財務評価に失敗しました");
      } finally {
        setIsLoading(false);
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
