"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Castle,
  Search,
  Loader2,
  Shield,
  TrendingUp,
  TrendingDown,
  Info,
  ImageIcon,
  Sparkles,
} from "lucide-react";
import {
  FinancialMetricsResponse,
  CastleVisualizerProps,
} from "./types";
import {
  getRankBackgroundClass,
  getRankBorderClass,
} from "@/lib/castle/generateCastlePrompt";

/**
 * 指標名の日本語マッピング
 */
const METRIC_LABELS: Record<string, { name: string; description: string; ideal: string }> = {
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

export function CastleVisualizer({ symbol: initialSymbol, onClose }: CastleVisualizerProps) {
  const [symbol, setSymbol] = useState(initialSymbol || "");
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [result, setResult] = useState<FinancialMetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * 財務データを取得
   */
  const fetchFinancialData = useCallback(async () => {
    if (!symbol.trim()) {
      setError("証券コードを入力してください");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const { getApiUrl } = await import("@/lib/utils/apiClient");
      const response = await fetch(
        `${getApiUrl("/api/castle/financial-metrics")}?symbol=${encodeURIComponent(symbol.trim())}`
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

  /**
   * Enterキーで検索
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      fetchFinancialData();
    }
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Castle className="h-8 w-8 text-amber-600" />
        <div>
          <h2 className="text-2xl font-bold text-foreground">企業城郭図鑑</h2>
          <p className="text-sm text-muted-foreground">
            財務指標から企業の堅牢性を「お城」で視覚化
          </p>
        </div>
      </div>

      {/* 検索セクション */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            企業を検索
          </CardTitle>
          <CardDescription>
            証券コード（例: AAPL, 7203.T）を入力してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="証券コードを入力..."
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
              disabled={isLoading}
            />
            <Button
              onClick={fetchFinancialData}
              disabled={isLoading || !symbol.trim()}
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
          </div>
        </CardContent>
      </Card>

      {/* エラー表示 */}
      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 結果表示 */}
      {result && (
        <div className="space-y-6">
          {/* ランクカード */}
          <Card
            className={`border-2 ${getRankBorderClass(result.rank)} bg-gradient-to-r ${getRankBackgroundClass(result.rank)}`}
          >
            <CardContent className="pt-6">
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
                      <p className="text-sm text-gray-500 text-center px-4">
                        「城を生成」ボタンでお城のイラストを作成できます
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

                  {/* 画像生成ボタン（画像がある場合は再生成ボタン） */}
                  {result.imageUrl && (
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
            </CardContent>
          </Card>

          {/* 指標詳細 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5" />
                財務指標詳細
              </CardTitle>
              <CardDescription>
                各指標のスコアと実際の数値
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(
                  Object.keys(METRIC_LABELS) as Array<
                    keyof typeof METRIC_LABELS
                  >
                ).map((key) => {
                  const metricInfo = METRIC_LABELS[key];
                  const score =
                    result.scores[key as keyof typeof result.scores];
                  const value =
                    result.metrics[key as keyof typeof result.metrics];
                  const isInverse = key === "fixedRatio"; // 固定比率は低いほど良い

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
                          <span className="font-medium">
                            {metricInfo.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            {formatMetricValue(key, value)}
                          </span>
                          <span
                            className={`font-bold ${getScoreColor(score)}`}
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
            </CardContent>
          </Card>

          {/* 重み付け説明 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">
                スコア算出の重み付け
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 text-xs">
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
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
