import { useState, useRef, useCallback, useEffect } from "react";
import { AnalysisResult } from "@/lib/api/openrouter";
import { parseSSE, splitNarrativeAndJson } from "@/lib/api/analysisStream";
import { getApiUrl, getAuthHeaders } from "@/lib/utils/apiClient";
import { CapacitorHttp } from "@capacitor/core";
import { toFriendlyErrorMessage } from "@/lib/friendlyError";

const ANALYSIS_ERROR_FALLBACK =
  "AI分析を完了できませんでした。少し待ってから再試行してください。";

function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (
    window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
  ).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

export function useAIAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [streamingText, setStreamingText] = useState("");
  // 構造化結果を受け取った時刻。画面に「いつ生成した分析か」を出すために使う
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [bundleTokens, setBundleTokens] = useState<{
    financial: string;
    news: string;
  } | null>(null);
  const lastArgsRef = useRef<{
    companyInfo: any;
    stockData: any;
    newsData: any[];
    edinetExtras?: {
      ratios?: any;
      financialHistory?: any[] | null;
      accountingStandard?: string | null;
    };
    question?: string;
  } | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const analyzeStock = useCallback(
    async (
      companyInfo: any,
      stockData: any,
      newsData: any[],
      edinetExtras?: {
        ratios?: any;
        financialHistory?: any[] | null;
        accountingStandard?: string | null;
      },
      question?: string
    ) => {
      lastArgsRef.current = {
        companyInfo,
        stockData,
        newsData,
        edinetExtras,
        question,
      };
      setStreamingText("");
      setAnalysisResult(null);
      setAnalyzedAt(null);
      setBundleTokens(null);
      setError(null);
      setIsAnalyzing(true);

      try {
        const headers = await getAuthHeaders();

        if (isCapacitorNative()) {
          const response = await CapacitorHttp.post({
            url: getApiUrl("/api/analyze"),
            headers,
            data: {
              companyInfo,
              stockData,
              newsData,
              ...(edinetExtras ? { edinetExtras } : {}),
              ...(question ? { question } : {}),
            },
          });

          if (response.status !== 200) {
            if (!mountedRef.current) return;
            setError(
              toFriendlyErrorMessage(
                response.data?.error,
                ANALYSIS_ERROR_FALLBACK
              )
            );
            return;
          }

          const raw =
            typeof response.data === "string"
              ? response.data
              : String(response.data);
          const events = parseSSE(raw);
          let narrative = "";
          for (const ev of events) {
            if (ev.event === "narrative") {
              narrative += ev.data;
            } else if (ev.event === "result") {
              try {
                if (!mountedRef.current) return;
                setAnalysisResult(JSON.parse(ev.data));
                setAnalyzedAt(prev => prev ?? new Date().toISOString());
              } catch {
                // ignore parse errors on result
              }
            } else if (ev.event === "bundle") {
              try {
                if (!mountedRef.current) return;
                setBundleTokens(JSON.parse(ev.data));
              } catch {
                // ignore parse errors on bundle tokens
              }
            } else if (ev.event === "error") {
              if (!mountedRef.current) return;
              setError(
                toFriendlyErrorMessage(ev.data, ANALYSIS_ERROR_FALLBACK)
              );
              return;
            }
          }
          if (!mountedRef.current) return;
          setStreamingText(splitNarrativeAndJson(narrative).narrative);
        } else {
          const res = await fetch(getApiUrl("/api/analyze"), {
            method: "POST",
            headers,
            body: JSON.stringify({
              companyInfo,
              stockData,
              newsData,
              ...(edinetExtras ? { edinetExtras } : {}),
              ...(question ? { question } : {}),
            }),
          });

          if (
            !res.ok ||
            (res.headers.get("content-type") || "").includes("application/json")
          ) {
            const json = await res.json();
            if (!mountedRef.current) return;
            setError(
              toFriendlyErrorMessage(json.error, ANALYSIS_ERROR_FALLBACK)
            );
            return;
          }

          if (!res.body) {
            if (!mountedRef.current) return;
            setError(ANALYSIS_ERROR_FALLBACK);
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            accumulated += decoder.decode(value, { stream: true });

            const events = parseSSE(accumulated);
            let narrative = "";
            for (const ev of events) {
              if (ev.event === "narrative") {
                narrative += ev.data;
              } else if (ev.event === "result") {
                try {
                  if (!mountedRef.current) return;
                  setAnalysisResult(JSON.parse(ev.data));
                  setAnalyzedAt(prev => prev ?? new Date().toISOString());
                } catch {
                  // ignore parse errors on result
                }
              } else if (ev.event === "bundle") {
                try {
                  if (!mountedRef.current) return;
                  setBundleTokens(JSON.parse(ev.data));
                } catch {
                  // ignore parse errors on bundle tokens
                }
              } else if (ev.event === "error") {
                if (!mountedRef.current) return;
                setError(
                  toFriendlyErrorMessage(ev.data, ANALYSIS_ERROR_FALLBACK)
                );
                return;
              }
            }
            if (!mountedRef.current) return;
            setStreamingText(splitNarrativeAndJson(narrative).narrative);
          }
        }
      } catch (err) {
        if (!mountedRef.current) return;
        setError(
          toFriendlyErrorMessage(
            err instanceof Error ? err.message : null,
            ANALYSIS_ERROR_FALLBACK
          )
        );
      } finally {
        if (mountedRef.current) setIsAnalyzing(false);
      }
    },
    []
  );

  const retry = useCallback(() => {
    if (lastArgsRef.current) {
      const { companyInfo, stockData, newsData, edinetExtras, question } =
        lastArgsRef.current;
      analyzeStock(companyInfo, stockData, newsData, edinetExtras, question);
    }
  }, [analyzeStock]);

  const clearAnalysis = useCallback(() => {
    setAnalysisResult(null);
    setAnalyzedAt(null);
    setStreamingText("");
    setBundleTokens(null);
    setError(null);
  }, []);

  return {
    isAnalyzing,
    error,
    analysisResult,
    analyzedAt,
    streamingText,
    bundleTokens,
    analyzeStock,
    clearAnalysis,
    retry,
  };
}
