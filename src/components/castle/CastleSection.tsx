"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Castle,
  Loader2,
  Shield,
  TrendingUp,
  TrendingDown,
  Info,
  ImageIcon,
  Sparkles,
  Lock,
} from "lucide-react";
import { FinancialMetricsResponse } from "./types";
import {
  getRankBackgroundClass,
  getRankBorderClass,
} from "@/lib/castle/generateCastlePrompt";
import { useSubscription } from "@/hooks/useSubscription";

/**
 * 指標名の日本語マッピング
 */
const METRIC_LABELS: Record<
  string,
  { name: string; description: string; ideal: string }
> = {
  equityRatio: {
    name: "自己資本比率",
    description: "総資産に占める自己資本の割合。高いほど財務的に安定。",
    ideal: "40%以上で優良",
  },
  currentRatio: {
    name: "流動比率",
    description: "流動資産÷流動負債。短期的な支払い能力を示す。",
    ideal: "200%以上で優良",
  },
  fixedRatio: {
    name: "固定比率",
    description: "固定資産÷自己資本。低いほど財務的に安定。",
    ideal: "100%以下で優良",
  },
  cashRatio: {
    name: "現金比率",
    description: "現金÷流動負債。即座の支払い能力を示す。",
    ideal: "30%以上で優良",
  },
  interestCoverageRatio: {
    name: "ICR",
    description: "営業利益÷支払利息。利息支払い余力を示す。",
    ideal: "10倍以上で優良",
  },
};

/**
 * スコアに応じた色を返す
 */
function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-blue-600";
  if (score >= 40) return "text-yellow-600";
  if (score >= 20) return "text-orange-600";
  return "text-red-600";
}

/**
 * スコアバーの色を返す
 */
function getScoreBarColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 40) return "bg-yellow-500";
  if (score >= 20) return "bg-orange-500";
  return "bg-red-500";
}

/**
 * 指標値をフォーマット
 */
function formatMetricValue(key: string, value: number | null): string {
  if (value === null) return "N/A";
  if (key === "interestCoverageRatio") {
    return value.toFixed(2) + "倍";
  }
  return value.toFixed(1) + "%";
}

interface CastleSectionProps {
  symbol: string;
  companyName: string;
  edinetCode?: string | null;
}

export function CastleSection({ symbol, companyName, edinetCode }: CastleSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [result, setResult] = useState<FinancialMetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isPremium } = useSubscription();

  /**
   * 財務データを取得して城郭診断を実行
   */
  const analyzeCastle = useCallback(async () => {
    if (!symbol) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const { getApiUrl } = await import("@/lib/utils/apiClient");
      // EDINET コードがある場合は追加パラメータとして渡す
      const params = new URLSearchParams({ symbol });
      if (edinetCode) params.set("edinet_code", edinetCode);
      const response = await fetch(
        `${getApiUrl("/api/castle/financial-metrics")}?${params.toString()}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "データの取得に失敗しました");
      }

      const data: FinancialMetricsResponse = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  /**
   * 城の画像を生成
   */
  const generateCastleImage = useCallback(async () => {
    if (!result) return;

    setIsGeneratingImage(true);

    try {
      const { getApiUrl } = await import("@/lib/utils/apiClient");
      const response = await fetch(getApiUrl("/api/castle/generate-image"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rank: result.rank,
          companyName: result.companyName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "画像生成に失敗しました");
      }

      const data = await response.json();
      setResult((prev) =>
        prev ? { ...prev, imageUrl: data.imageUrl } : null
      );
    } catch (err: any) {
      setError(err.message || "画像生成エラー");
    } finally {
      setIsGeneratingImage(false);
    }
  }, [result]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Castle className="h-6 w-6 text-amber-600" />
            <div>
              <CardTitle className="text-lg">企業城郭図鑑</CardTitle>
              <CardDescription>
                財務指標から企業の堅牢性を「お城」で視覚化
              </CardDescription>
            </div>
          </div>
          {!result && (
            <Button
              onClick={analyzeCastle}
              disabled={isLoading || !symbol}
              size="sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  城郭診断
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* エラー表示 */}
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive mb-4">
            {error}
          </div>
        )}

        {/* 結果未取得時 */}
        {!result && !isLoading && !error && (
          <div className="text-center py-8 text-muted-foreground">
            <Castle className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>「城郭診断」ボタンを押して、{companyName}の財務城郭を確認しましょう</p>
          </div>
        )}

        {/* ローディング */}
        {isLoading && (
          <div className="text-center py-8">
            <Loader2 className="h-12 w-12 mx-auto mb-3 animate-spin text-amber-600" />
            <p className="text-muted-foreground">財務データを分析中...</p>
          </div>
        )}

        {/* 結果表示 */}
        {result && (
          <div className="space-y-6">
            {/* ランクカード */}
            <div
              className={`rounded-lg border-2 ${getRankBorderClass(result.rank)} bg-gradient-to-r ${getRankBackgroundClass(result.rank)} p-6`}
            >
              <div className="flex flex-col md:flex-row gap-6">
                {/* 左側: 城画像 */}
                <div className="md:w-1/2">
                  {result.imageUrl ? (
                    <div className="relative aspect-square rounded-lg overflow-hidden shadow-lg">
                      <Image
                        src={result.imageUrl}
                        alt={`${result.companyName}の城`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="aspect-square rounded-lg bg-white/50 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-gray-300">
                      <ImageIcon className="h-16 w-16 text-gray-400" />
                      {isPremium ? (
                        <>
                          <p className="text-sm text-gray-500 text-center px-4">
                            AIでお城のイラストを生成できます
                          </p>
                          <Button
                            onClick={generateCastleImage}
                            disabled={isGeneratingImage}
                            variant="outline"
                            className="mt-2"
                          >
                            {isGeneratingImage ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                生成中...
                              </>
                            ) : (
                              <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                城を生成
                              </>
                            )}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Lock className="h-8 w-8 text-gray-400" />
                          <p className="text-sm text-gray-500 text-center px-4">
                            プレミアム機能：AIでお城のイラストを生成
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* 右側: ランク情報 */}
                <div className="md:w-1/2 flex flex-col justify-center">
                  <div className="text-center md:text-left">
                    <p className="text-sm text-muted-foreground mb-1">
                      {result.companyName}
                    </p>
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                      <span
                        className={`text-6xl font-bold ${result.rankInfo.color}`}
                      >
                        {result.rank}
                      </span>
                      <div>
                        <p className="text-xl font-semibold">
                          {result.rankInfo.rankName}
                        </p>
                        <p className="text-3xl font-bold">
                          {result.totalScore}
                          <span className="text-lg text-muted-foreground">
                            /100点
                          </span>
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {result.rankInfo.description}
                    </p>
                  </div>

                  {/* 画像再生成ボタン（画像がある場合のみ） */}
                  {result.imageUrl && isPremium && (
                    <Button
                      onClick={generateCastleImage}
                      disabled={isGeneratingImage}
                      variant="outline"
                      className="mt-4"
                    >
                      {isGeneratingImage ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          再生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          城を再生成
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* 指標詳細 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Info className="h-4 w-4" />
                財務指標詳細
              </div>
              {(
                Object.keys(METRIC_LABELS) as Array<keyof typeof METRIC_LABELS>
              ).map((key) => {
                const metricInfo = METRIC_LABELS[key];
                const score = result.scores[key as keyof typeof result.scores];
                const value =
                  result.metrics[key as keyof typeof result.metrics];
                const isInverse = key === "fixedRatio";

                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isInverse ? (
                          score >= 50 ? (
                            <TrendingDown className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingUp className="h-4 w-4 text-red-500" />
                          )
                        ) : score >= 50 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-medium text-sm">
                          {metricInfo.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {formatMetricValue(key, value)}
                        </span>
                        <span
                          className={`font-bold text-sm ${getScoreColor(score)}`}
                        >
                          {score}点
                        </span>
                      </div>
                    </div>
                    <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${getScoreBarColor(score)}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {metricInfo.description}
                      <span className="ml-2 text-primary">
                        ({metricInfo.ideal})
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>

            {/* 重み付け説明 */}
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">
                スコア算出の重み付け:
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                  自己資本比率: 30%
                </span>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                  流動比率: 20%
                </span>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                  固定比率: 20%
                </span>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                  現金比率: 15%
                </span>
                <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded">
                  ICR: 15%
                </span>
              </div>
            </div>

            {/* 再診断ボタン */}
            <div className="pt-4 text-center">
              <Button variant="outline" size="sm" onClick={analyzeCastle}>
                <Shield className="mr-2 h-4 w-4" />
                再診断
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
