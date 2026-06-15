import { useState, useRef, useCallback, useEffect } from "react";
import { AnalysisResult } from "@/lib/api/openrouter";
import { parseSSE } from "@/lib/api/analysisStream";
import { getApiUrl, getAuthHeaders } from "@/lib/utils/apiClient";
import { CapacitorHttp } from "@capacitor/core";

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
  const lastArgsRef = useRef<{
    companyInfo: any;
    stockData: any;
    newsData: any[];
  } | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const analyzeStock = useCallback(
    async (companyInfo: any, stockData: any, newsData: any[]) => {
      lastArgsRef.current = { companyInfo, stockData, newsData };
      setStreamingText("");
      setAnalysisResult(null);
      setError(null);
      setIsAnalyzing(true);

      try {
        const headers = await getAuthHeaders();

        if (isCapacitorNative()) {
          const response = await CapacitorHttp.post({
            url: getApiUrl("/api/analyze"),
            headers,
            data: { companyInfo, stockData, newsData },
          });

          if (response.status !== 200) {
            if (!mountedRef.current) return;
            setError(response.data?.error || "分析に失敗しました");
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
              } catch {
                // ignore parse errors on result
              }
            } else if (ev.event === "error") {
              if (!mountedRef.current) return;
              setError(ev.data);
              return;
            }
          }
          if (!mountedRef.current) return;
          setStreamingText(narrative);
        } else {
          const res = await fetch(getApiUrl("/api/analyze"), {
            method: "POST",
            headers,
            body: JSON.stringify({ companyInfo, stockData, newsData }),
          });

          if (
            !res.ok ||
            (res.headers.get("content-type") || "").includes("application/json")
          ) {
            const json = await res.json();
            if (!mountedRef.current) return;
            setError(json.error || "分析に失敗しました");
            return;
          }

          if (!res.body) {
            if (!mountedRef.current) return;
            setError("AI分析中にエラーが発生しました");
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
                } catch {
                  // ignore parse errors on result
                }
              } else if (ev.event === "error") {
                if (!mountedRef.current) return;
                setError(ev.data);
                return;
              }
            }
            if (!mountedRef.current) return;
            setStreamingText(narrative);
          }
        }
      } catch (err) {
        if (!mountedRef.current) return;
        setError(
          err instanceof Error ? err.message : "分析中にエラーが発生しました"
        );
      } finally {
        if (mountedRef.current) setIsAnalyzing(false);
      }
    },
    []
  );

  const retry = useCallback(() => {
    if (lastArgsRef.current) {
      const { companyInfo, stockData, newsData } = lastArgsRef.current;
      analyzeStock(companyInfo, stockData, newsData);
    }
  }, [analyzeStock]);

  const clearAnalysis = useCallback(() => {
    setAnalysisResult(null);
    setStreamingText("");
    setError(null);
  }, []);

  return {
    isAnalyzing,
    error,
    analysisResult,
    streamingText,
    analyzeStock,
    clearAnalysis,
    retry,
  };
}
