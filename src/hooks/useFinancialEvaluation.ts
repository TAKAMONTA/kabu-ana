"use client";

import { useState, useCallback } from "react";
import { getApiUrl } from "@/lib/utils/apiClient";

export interface FinancialEvaluationResult {
  bs: { score: 1 | 2 | 3 | 4 | 5; summary: string };
  pl: { score: 1 | 2 | 3 | 4 | 5; summary: string };
  cf: { score: 1 | 2 | 3 | 4 | 5; summary: string };
  overall: { score: 1 | 2 | 3 | 4 | 5; label: string };
  analysis: string;
  recommendations: string[];
}

export function useFinancialEvaluation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinancialEvaluationResult | null>(null);

  const evaluate = useCallback(
    async (args: {
      symbol: string;
      companyName: string;
      financialData?: any;
    }) => {
      setIsLoading(true);
      setError(null);
      try {
        const cleanedFinancialData = args.financialData
          ? Object.fromEntries(
              Object.entries(args.financialData).filter(([, v]) => v != null && v !== "")
            )
          : {};

        const res = await fetch(getApiUrl("/api/financial-evaluation"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: args.symbol,
            companyName: args.companyName,
            financialData: cleanedFinancialData,
          }),
        });

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("サーバーとの通信に問題が発生しました。しばらくしてから再試行してください。");
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "財務評価に失敗しました");
        setResult(data.analysis);
      } catch (e: any) {
        if (e instanceof TypeError && (e.message.includes("Failed to fetch") || e.message.includes("NetworkError"))) {
          setError("ネットワークエラーが発生しました。接続を確認してください。");
        } else {
          setError(e.message || "財務評価に失敗しました");
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clear = useCallback(() => setResult(null), []);

  return { isLoading, error, result, evaluate, clear } as const;
}
