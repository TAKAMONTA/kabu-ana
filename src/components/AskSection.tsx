"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Brain, Lock } from "lucide-react";
import { AnalysisResult } from "@/lib/api/openrouter";

interface AskSectionProps {
  isAnalyzing: boolean;
  streamingText: string;
  analysisResult: AnalysisResult | null;
  canUseFeature?: boolean;
  remainingUses?: number;
  dailyLimit?: number;
  isPremium?: boolean;
  currencySymbol?: string;
}

export function AskSection({
  isAnalyzing,
  streamingText,
  analysisResult,
  canUseFeature = true,
  remainingUses = 5,
  dailyLimit = 5,
  isPremium = false,
  currencySymbol = "¥",
}: AskSectionProps) {
  const hasResponse = analysisResult || (isAnalyzing && streamingText);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI自動分析（参考情報）
        </CardTitle>
        <CardDescription>
          検索後にAI分析を自動表示します。無料ユーザーは1日{dailyLimit}
          回まで利用できます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isPremium && canUseFeature && (
          <p className="text-xs text-muted-foreground">
            自動AI分析の残り {remainingUses}/{dailyLimit} 回
          </p>
        )}

        {!canUseFeature && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
            <Lock className="h-4 w-4 shrink-0" />
            <span>
              本日の無料AI分析上限に達しました。プレミアムプランで無制限にご利用いただけます。
            </span>
          </div>
        )}

        {(isAnalyzing || hasResponse) && (
          <div className="space-y-4 border-t pt-4">
            {(streamingText || isAnalyzing) && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs font-semibold text-slate-500 mb-2 dark:text-slate-400">
                  AIの分析文
                </p>
                <p className="text-sm text-slate-800 leading-relaxed dark:text-slate-200 whitespace-pre-wrap">
                  {streamingText}
                  {isAnalyzing && !streamingText && (
                    <>
                      <span className="inline-block animate-bounce">.</span>
                      <span
                        className="inline-block animate-bounce"
                        style={{ animationDelay: "0.15s" }}
                      >
                        .
                      </span>
                      <span
                        className="inline-block animate-bounce"
                        style={{ animationDelay: "0.3s" }}
                      >
                        .
                      </span>
                    </>
                  )}
                  {isAnalyzing && streamingText && (
                    <span className="animate-pulse">▋</span>
                  )}
                </p>
              </div>
            )}

            {analysisResult && (
              <>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                  本分析は情報提供を目的とした参考情報であり、投資助言・売買推奨ではありません。最終的な判断はご自身で行ってください。
                </div>

                {analysisResult.investmentAdvice && (
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-lg border border-blue-200 dark:from-blue-950 dark:to-blue-900/50 dark:border-blue-800">
                    <p className="text-xs font-semibold text-blue-600 mb-2 dark:text-blue-300">
                      分析サマリー
                    </p>
                    <p className="text-sm text-blue-900 leading-relaxed dark:text-blue-200">
                      {analysisResult.investmentAdvice}
                    </p>
                    <p className="text-xs text-blue-500 mt-2 dark:text-blue-400">
                      信頼度: {analysisResult.confidence}%
                    </p>
                  </div>
                )}

                {analysisResult.targetPrice && (
                  <div>
                    <h4 className="text-sm font-bold mb-3">AI推定レンジ</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "短期", value: analysisResult.targetPrice.shortTerm },
                        { label: "中期", value: analysisResult.targetPrice.mediumTerm },
                        { label: "長期", value: analysisResult.targetPrice.longTerm },
                      ].map(t => (
                        <div
                          key={t.label}
                          className="text-center p-3 border rounded-lg bg-gradient-to-br from-green-50 to-green-100 border-green-300 dark:from-green-950 dark:to-green-900 dark:border-green-800"
                        >
                          <p className="text-xs font-bold text-green-700 mb-1 dark:text-green-300">
                            {t.label}
                          </p>
                          <p className="text-base font-bold text-green-900 dark:text-green-200">
                            {currencySymbol}
                            {t.value.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysisResult.stopLoss && (
                  <div>
                    <h4 className="text-sm font-bold mb-3">下振れリスク目安</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "短期", value: analysisResult.stopLoss.shortTerm },
                        { label: "中期", value: analysisResult.stopLoss.mediumTerm },
                        { label: "長期", value: analysisResult.stopLoss.longTerm },
                      ].map(t => (
                        <div
                          key={t.label}
                          className="text-center p-3 border rounded-lg bg-gradient-to-br from-red-50 to-red-100 border-red-300 dark:from-red-950 dark:to-red-900 dark:border-red-800"
                        >
                          <p className="text-xs font-bold text-red-700 mb-1 dark:text-red-300">
                            {t.label}
                          </p>
                          <p className="text-base font-bold text-red-900 dark:text-red-200">
                            {currencySymbol}
                            {t.value.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysisResult.riskLevel && (
                  <div className="p-4 border rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 dark:from-slate-900 dark:to-slate-800 dark:border-slate-700">
                    <p className="text-xs font-bold text-slate-500 mb-2 dark:text-slate-400">
                      リスクレベル
                    </p>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                        analysisResult.riskLevel === "low"
                          ? "bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-200"
                          : analysisResult.riskLevel === "medium"
                            ? "bg-yellow-200 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-200"
                            : "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200"
                      }`}
                    >
                      {analysisResult.riskLevel === "low"
                        ? "低リスク"
                        : analysisResult.riskLevel === "medium"
                          ? "中リスク"
                          : "高リスク"}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {analysisResult.keyFactors?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">重要な要因</h4>
                      <ul className="space-y-1.5">
                        {analysisResult.keyFactors.map((factor, i) => (
                          <li
                            key={i}
                            className="text-sm text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-primary"
                          >
                            {factor}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysisResult.recommendations?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">確認ポイント</h4>
                      <ul className="space-y-1.5">
                        {analysisResult.recommendations.map((rec, i) => (
                          <li
                            key={i}
                            className="text-sm text-muted-foreground pl-4 relative before:content-['→'] before:absolute before:left-0 before:text-primary"
                          >
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {analysisResult.swot && (
                  <div>
                    <h4 className="text-sm font-bold mb-3">SWOT分析</h4>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {[
                        {
                          title: "強み",
                          items: analysisResult.swot.strengths,
                          className:
                            "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/30 dark:text-green-100",
                        },
                        {
                          title: "弱み",
                          items: analysisResult.swot.weaknesses,
                          className:
                            "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100",
                        },
                        {
                          title: "機会",
                          items: analysisResult.swot.opportunities,
                          className:
                            "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100",
                        },
                        {
                          title: "脅威",
                          items: analysisResult.swot.threats,
                          className:
                            "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-100",
                        },
                      ].map(section => (
                        <div
                          key={section.title}
                          className={`rounded-lg border p-3 ${section.className}`}
                        >
                          <p className="mb-2 text-sm font-semibold">
                            {section.title}
                          </p>
                          <ul className="space-y-1.5">
                            {section.items.map((item, i) => (
                              <li key={i} className="text-xs leading-relaxed">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysisResult.aiReflection && (
                  <div className="rounded-lg border border-purple-200 bg-purple-50/70 p-4 dark:border-purple-900 dark:bg-purple-950/30">
                    <p className="mb-2 text-xs font-semibold text-purple-700 dark:text-purple-300">
                      AIの見立て
                    </p>
                    <p className="text-sm leading-relaxed text-purple-950 dark:text-purple-100">
                      {analysisResult.aiReflection}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
