"use client";

import { useState, useCallback } from "react";

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
        const res = await fetch("/api/financial-evaluation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "財務評価に失敗しました");
        setResult(data.analysis);
      } catch (e: any) {
        setError(e.message || "財務評価に失敗しました");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clear = useCallback(() => setResult(null), []);

  return { isLoading, error, result, evaluate, clear } as const;
}
