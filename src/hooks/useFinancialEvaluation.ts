"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FinancialEvaluationResult } from "@/lib/api/openrouter";
import { getApiUrl, getAuthHeaders } from "@/lib/utils/apiClient";
import { CapacitorHttp } from "@capacitor/core";
import { toFriendlyErrorMessage } from "@/lib/friendlyError";

const FINANCIAL_ERROR_FALLBACK =
  "財務の評価を取得できませんでした。少し待ってから再試行してください。";

interface FinancialEvaluationArgs {
  symbol: string;
  companyName: string;
  financialData?: any;
  edinetExtras?: {
    ratios?: any;
    financialHistory?: any[] | null;
    accountingStandard?: string | null;
  };
}

interface FinancialEvaluationOptions {
  /** メインAI分析が発行した同梱トークン。付けると無料回数を消費しない */
  bundleToken?: string;
}

export function useFinancialEvaluation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinancialEvaluationResult | null>(null);
  // 再試行でも同梱トークンを付け直せるよう、オプションごと覚えておく
  const lastArgsRef = useRef<{
    args: FinancialEvaluationArgs;
    options?: FinancialEvaluationOptions;
  } | null>(null);
  const mountedRef = useRef(true);
  // 銘柄を切り替えたあとに前の銘柄の応答が届いても反映しない
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const evaluate = useCallback(
    async (
      args: FinancialEvaluationArgs,
      options?: FinancialEvaluationOptions
    ) => {
      const requestId = ++requestIdRef.current;
      const isCurrent = () =>
        mountedRef.current && requestIdRef.current === requestId;
      lastArgsRef.current = { args, options };
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
          throw new Error(data?.error || FINANCIAL_ERROR_FALLBACK);
        if (!isCurrent()) return;
        setResult(data.analysis);
      } catch (e: unknown) {
        if (!isCurrent()) return;
        setError(
          toFriendlyErrorMessage(
            e instanceof Error ? e.message : null,
            FINANCIAL_ERROR_FALLBACK
          )
        );
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    },
    []
  );

  const retry = useCallback(() => {
    if (lastArgsRef.current) {
      const { args, options } = lastArgsRef.current;
      void evaluate(args, options);
    }
  }, [evaluate]);

  /** 結果・エラー・再試行の対象を破棄し、実行中の応答も反映しないようにする */
  const clear = useCallback(() => {
    requestIdRef.current++;
    lastArgsRef.current = null;
    setResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { isLoading, error, result, evaluate, clear, retry } as const;
}
