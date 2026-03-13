"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Brain, TrendingUp, Lock } from "lucide-react";
import { AnalysisResult } from "@/lib/api/openrouter";

interface AnalysisSectionProps {
  analysisResult: AnalysisResult | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  currencySymbol: string;
  canUseFeature?: boolean;
  remainingUses?: number;
  dailyLimit?: number;
  isPremium?: boolean;
}

export function AnalysisSection({
  analysisResult,
  isAnalyzing,
  onAnalyze,
  currencySymbol,
  canUseFeature = true,
  remainingUses = 5,
  dailyLimit = 5,
  isPremium = false,
}: AnalysisSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI投資分析
        </CardTitle>
        <CardDescription>
          AIが企業の投資価値を分析し、投資判断をサポートします
        </CardDescription>
      </CardHeader>
      <CardContent>
        {analysisResult ? (
          <div className="space-y-6">
            {/* 投資アドバイス */}
            <div className="p-6 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-lg border-2 border-blue-300 shadow-sm">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-blue-200 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-800" />
                </div>
                <div>
                  <h4 className="font-bold text-blue-950 text-lg">
                    📊 投資アドバイス
                  </h4>
                  <p className="text-sm text-blue-700 mt-1">
                    総合的な投資判断とリスク評価
                  </p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                <p className="text-sm text-blue-900 leading-relaxed">
                  {analysisResult.investmentAdvice}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-blue-600">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  信頼度: {analysisResult.confidence}%
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  最終更新: {new Date().toLocaleDateString("ja-JP")}
                </span>
              </div>
            </div>

            {/* 目標株価 */}
            <div>
              <h4 className="font-bold mb-4 text-base">🎯 目標株価</h4>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "短期",
                    value: analysisResult.targetPrice.shortTerm,
                  },
                  {
                    label: "中期",
                    value: analysisResult.targetPrice.mediumTerm,
                  },
                  {
                    label: "長期",
                    value: analysisResult.targetPrice.longTerm,
                  },
                ].map(target => (
                  <div
                    key={target.label}
                    className="text-center p-4 border-2 rounded-lg bg-gradient-to-br from-green-50 to-green-100 border-green-300 hover:shadow-md transition-shadow"
                  >
                    <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">
                      {target.label}
                    </p>
                    <p className="text-xl font-bold text-green-900">
                      {currencySymbol}
                      {target.value.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 損切りライン */}
            <div>
              <h4 className="font-bold mb-4 text-base">⚠️ 損切りライン</h4>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "短期",
                    value: analysisResult.stopLoss.shortTerm,
                  },
                  {
                    label: "中期",
                    value: analysisResult.stopLoss.mediumTerm,
                  },
                  {
                    label: "長期",
                    value: analysisResult.stopLoss.longTerm,
                  },
                ].map(target => (
                  <div
                    key={target.label}
                    className="text-center p-4 border-2 rounded-lg border-red-300 bg-gradient-to-br from-red-50 to-red-100 hover:shadow-md transition-shadow"
                  >
                    <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">
                      {target.label}
                    </p>
                    <p className="text-xl font-bold text-red-900">
                      {currencySymbol}
                      {target.value.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* リスクレベル */}
            <div className="p-5 border-2 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 border-slate-300">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">
                🎯 リスクレベル
              </p>
              <span
                className={`inline-block px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  analysisResult.riskLevel === "low"
                    ? "bg-green-200 text-green-900"
                    : analysisResult.riskLevel === "medium"
                    ? "bg-yellow-200 text-yellow-900"
                    : "bg-red-200 text-red-900"
                }`}
              >
                {analysisResult.riskLevel === "low"
                  ? "🟢 低リスク"
                  : analysisResult.riskLevel === "medium"
                  ? "🟡 中リスク"
                  : "🔴 高リスク"}
              </span>
            </div>

            {/* 重要な要因と推奨事項を横並びに配置 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 重要な要因 */}
              {analysisResult.keyFactors.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">重要な要因</h4>
                  <ul className="space-y-2">
                    {analysisResult.keyFactors.map((factor, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-muted-foreground pl-5 relative before:content-['•'] before:absolute before:left-0 before:text-primary"
                      >
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 推奨事項 */}
              {analysisResult.recommendations.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">推奨事項</h4>
                  <ul className="space-y-2">
                    {analysisResult.recommendations.map((rec, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-muted-foreground pl-5 relative before:content-['→'] before:absolute before:left-0 before:text-primary"
                      >
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* SWOT分析 */}
            {analysisResult.swot && (
              <div>
                <h4 className="font-bold mb-4 text-base">📊 SWOT分析</h4>
                <div className="grid grid-cols-2 gap-4">
                  {/* 強み (Strengths) */}
                  <div className="p-4 border-2 rounded-lg bg-gradient-to-br from-green-50 to-green-100 border-green-300">
                    <h5 className="font-bold text-green-900 mb-3 text-sm">
                      ✅ 強み (Strengths)
                    </h5>
                    <ul className="space-y-2">
                      {analysisResult.swot.strengths.map((item, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-green-800 pl-3 relative before:content-['✓'] before:absolute before:left-0 before:font-bold"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 弱み (Weaknesses) */}
                  <div className="p-4 border-2 rounded-lg bg-gradient-to-br from-red-50 to-red-100 border-red-300">
                    <h5 className="font-bold text-red-900 mb-3 text-sm">
                      ⚠️ 弱み (Weaknesses)
                    </h5>
                    <ul className="space-y-2">
                      {analysisResult.swot.weaknesses.map((item, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-red-800 pl-3 relative before:content-['×'] before:absolute before:left-0 before:font-bold"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 機会 (Opportunities) */}
                  <div className="p-4 border-2 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300">
                    <h5 className="font-bold text-blue-900 mb-3 text-sm">
                      💡 機会 (Opportunities)
                    </h5>
                    <ul className="space-y-2">
                      {analysisResult.swot.opportunities.map((item, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-blue-800 pl-3 relative before:content-['→'] before:absolute before:left-0 before:font-bold"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 脅威 (Threats) */}
                  <div className="p-4 border-2 rounded-lg bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300">
                    <h5 className="font-bold text-yellow-900 mb-3 text-sm">
                      🚨 脅威 (Threats)
                    </h5>
                    <ul className="space-y-2">
                      {analysisResult.swot.threats.map((item, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-yellow-800 pl-3 relative before:content-['⚡'] before:absolute before:left-0 before:font-bold"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* AI感想セクション */}
            {analysisResult.aiReflection && (
              <div className="mt-6 p-4 border-2 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 border-purple-300">
                <h4 className="font-bold text-purple-900 mb-3 text-base flex items-center gap-2">
                  🤖 AIの感想
                </h4>
                <div className="bg-white p-4 rounded-lg border border-purple-200">
                  <p className="text-sm text-gray-700 leading-relaxed italic">
                    &ldquo;{analysisResult.aiReflection}&rdquo;
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              AI分析はまだ実行されていません。下のボタンで分析を開始できます。
            </p>

            {/* 残り回数バッジ（プレミアムでない場合） */}
            {!isPremium && (
              <div className="mb-3">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                  canUseFeature
                    ? "bg-blue-100 text-blue-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  本日の残り回数: {remainingUses}/{dailyLimit}
                </span>
              </div>
            )}

            {canUseFeature ? (
              <Button
                onClick={onAnalyze}
                disabled={isAnalyzing}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Brain className="h-4 w-4 mr-2 animate-spin" />
                    分析を実行中...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    AI分析を開始
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <Button disabled className="w-full opacity-50">
                  <Lock className="h-4 w-4 mr-2" />
                  本日の利用上限に達しました
                </Button>
                <p className="text-xs text-muted-foreground">
                  プレミアムプランにアップグレードすると無制限にご利用いただけます
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
