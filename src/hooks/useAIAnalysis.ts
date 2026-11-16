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

/**
 * メインAI分析の進み具合。
 * - idle: 未実行（または clearAnalysis 後）
 * - running: 実行中
 * - done: エラーなく終わった（結果が無い場合も含む）
 * - error: エラーで終わった
 */
export type AnalysisStatus = "idle" | "running" | "done" | "error";

export function useAIAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
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
  // 銘柄を切り替えたあとに前の銘柄の応答が届いても反映しないよう、
  // リクエストごとに番号を振り、最新のものだけを画面に反映する
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
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
    ): Promise<boolean> => {
      const requestId = ++requestIdRef.current;
      const isCurrent = () =>
        mountedRef.current && requestIdRef.current === requestId;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const fail = (message: string) => {
        setError(message);
        setStatus("error");
      };

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
      setStatus("running");

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
            if (!isCurrent()) return false;
            fail(
              toFriendlyErrorMessage(
                response.data?.error,
                ANALYSIS_ERROR_FALLBACK
              )
            );
            return false;
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
                if (!isCurrent()) return false;
                setAnalysisResult(JSON.parse(ev.data));
                setAnalyzedAt(prev => prev ?? new Date().toISOString());
              } catch {
                // ignore parse errors on result
              }
            } else if (ev.event === "bundle") {
              try {
                if (!isCurrent()) return false;
                setBundleTokens(JSON.parse(ev.data));
              } catch {
                // ignore parse errors on bundle tokens
              }
            } else if (ev.event === "error") {
              if (!isCurrent()) return false;
              fail(toFriendlyErrorMessage(ev.data, ANALYSIS_ERROR_FALLBACK));
              return false;
            }
          }
          if (!isCurrent()) return false;
          setStreamingText(splitNarrativeAndJson(narrative).narrative);
        } else {
          const res = await fetch(getApiUrl("/api/analyze"), {
            method: "POST",
            headers,
            signal: controller.signal,
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
            const json = await res.json().catch(() => null);
            if (!isCurrent()) return false;
            fail(toFriendlyErrorMessage(json?.error, ANALYSIS_ERROR_FALLBACK));
            return false;
          }

          if (!res.body) {
            if (!isCurrent()) return false;
            fail(ANALYSIS_ERROR_FALLBACK);
            return false;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!isCurrent()) {
              void reader.cancel().catch(() => {});
              return false;
            }
            accumulated += decoder.decode(value, { stream: true });

            const events = parseSSE(accumulated);
            let narrative = "";
            for (const ev of events) {
              if (ev.event === "narrative") {
                narrative += ev.data;
              } else if (ev.event === "result") {
                try {
                  if (!isCurrent()) return false;
                  setAnalysisResult(JSON.parse(ev.data));
                  setAnalyzedAt(prev => prev ?? new Date().toISOString());
                } catch {
                  // ignore parse errors on result
                }
              } else if (ev.event === "bundle") {
                try {
                  if (!isCurrent()) return false;
                  setBundleTokens(JSON.parse(ev.data));
                } catch {
                  // ignore parse errors on bundle tokens
                }
              } else if (ev.event === "error") {
                if (!isCurrent()) return false;
                fail(toFriendlyErrorMessage(ev.data, ANALYSIS_ERROR_FALLBACK));
                return false;
              }
            }
            if (!isCurrent()) return false;
            setStreamingText(splitNarrativeAndJson(narrative).narrative);
          }
        }
        if (!isCurrent()) return false;
        setStatus("done");
        return true;
      } catch (err) {
        // clearAnalysis や次の分析開始で中断した場合は何も表示しない
        if (!isCurrent()) return false;
        fail(
          toFriendlyErrorMessage(
            err instanceof Error ? err.message : null,
            ANALYSIS_ERROR_FALLBACK
          )
        );
        return false;
      } finally {
        if (isCurrent()) {
          setIsAnalyzing(false);
          if (abortRef.current === controller) abortRef.current = null;
        }
      }
    },
    []
  );

  /** 直前の分析をやり直す。成功したら true */
  const retry = useCallback(async (): Promise<boolean> => {
    if (!lastArgsRef.current) return false;
    const { companyInfo, stockData, newsData, edinetExtras, question } =
      lastArgsRef.current;
    return analyzeStock(
      companyInfo,
      stockData,
      newsData,
      edinetExtras,
      question
    );
  }, [analyzeStock]);

  /**
   * 表示中の分析を破棄する。実行中のリクエストは中断し、後から届いた応答も
   * 反映しない（別の銘柄に前の銘柄の結果・エラー・再試行が出ないようにする）
   */
  const clearAnalysis = useCallback(() => {
    requestIdRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    lastArgsRef.current = null;
    setIsAnalyzing(false);
    setStatus("idle");
    setAnalysisResult(null);
    setAnalyzedAt(null);
    setStreamingText("");
    setBundleTokens(null);
    setError(null);
  }, []);

  return {
    isAnalyzing,
    status,
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
