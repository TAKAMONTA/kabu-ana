"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import type {
  AIAnalysisData,
  AnalysisResponse,
  AnalysisProgress,
} from "@/app/types/ai";
import PerplexityBasedAnalysis from "@/app/components/PerplexityBasedAnalysis";

const DEFAULT_QUOTE = "情報は力である";

function AnalysisContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [analysisData, setAnalysisData] = useState<AIAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState(DEFAULT_QUOTE);

  useEffect(() => {
    const query = searchParams.get("q") || "";
    if (!query) {
      setError("検索クエリが見つかりません");
      setLoading(false);
      return;
    }

    const perplexityParam = searchParams.get("perplexity");
    let perplexityData = null;
    if (perplexityParam) {
      try {
        perplexityData = JSON.parse(perplexityParam);
      } catch (e) {
        console.error("Failed to parse perplexity info:", e);
      }
    }

    const runAnalysis = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/analysis", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            perplexityData,
          }),
        });

        const result: AnalysisResponse = await response.json();

        if (!result.success) {
          throw new Error(result.error || "分析に失敗しました");
        }

        if (!result.data) {
          throw new Error("分析データが取得できませんでした");
        }

        setAnalysisData(result.data);
      } catch (e: any) {
        console.error("Analysis error:", e);
        setError(e?.message || "分析中にエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    runAnalysis();
  }, [searchParams]);

  const handleClose = () => {
    router.push("/karte");
  };

  const handleRetry = () => {
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            AI分析を実行中...
          </h2>
          <p className="text-gray-500">しばらくお待ちください</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            エラーが発生しました
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-x-4">
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              再試行
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            分析データが見つかりません
          </h2>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <button
              onClick={handleClose}
              className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              戻る
            </button>
            <h1 className="text-xl font-semibold text-gray-800">AI分析結果</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="p-6">
        <PerplexityBasedAnalysis
          analysisData={analysisData}
          onClose={handleClose}
        />
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              読み込み中...
            </h2>
          </div>
        </div>
      }
    >
      <AnalysisContent />
    </Suspense>
  );
}
