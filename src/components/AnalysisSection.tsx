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
import { Brain, TrendingUp, Lock, Crown } from "lucide-react";
import { AnalysisResult } from "@/lib/api/openrouter";

interface AnalysisSectionProps {
  analysisResult: AnalysisResult | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  currencySymbol: string;
  // プレミアム関連
  isPremium: boolean;
  canUse: boolean;
  remainingUsage: number;
  dailyLimit: number;
  onUpgrade: () => void;
}

/**
 * プレミアム限定コンテンツのロック表示
 */
function PremiumLock({ title, onUpgrade }: { title: string; onUpgrade: () => void }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background z-10 flex items-end justify-center pb-4">
        <div className="text-center">
          <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold text-muted-foreground mb-2">
            {title}はプレミアム限定
          </p>
          <Button
            size="sm"
            onClick={onUpgrade}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            <Crown className="h-4 w-4 mr-1" />
            プレミアムにアップグレード
          </Button>
        </div>
      </div>
      <div className="opacity-30 blur-sm pointer-events-none" aria-hidden="true">
        {/* プレースホルダーコンテンツ */}
        <div className="h-32 bg-muted rounded-lg"></div>
      </div>
    </div>
  );
}

export function AnalysisSection({
  analysisResult,
  isAnalyzing,
  onAnalyze,
  currencySymbol,
  isPremium,
  canUse,
  remainingUsage,
  dailyLimit,
  onUpgrade,
}: AnalysisSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI投資分析
          {!isPremium && (
            <span className="ml-2 text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
              残り{remainingUsage}/{dailyLimit}回
            </span>
          )}
        </CardTitle>
        <CardDescription>
          AIが企業の投資価値を分析し、投資判断をサポートします
        </CardDescription>
      </CardHeader>
      <CardContent>
        {analysisResult ? (
          <div className="space-y-6">
            {/* 投資アドバイス - 全ユーザーに表示 */}
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

            {/* 目標株価 - プレミアム限定 */}
            {isPremium ? (
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
            ) : (
              <div>
                <h4 className="font-bold mb-4 text-base flex items-center gap-2">
                  🎯 目標株価
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </h4>
                <PremiumLock title="目標株価" onUpgrade={onUpgrade} />
              </div>
            )}

            {/* 損切りライン - プレミアム限定 */}
            {isPremium ? (
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
            ) : (
              <div>
                <h4 className="font-bold mb-4 text-base flex items-center gap-2">
                  ⚠️ 損切りライン
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </h4>
                <PremiumLock title="損切りライン" onUpgrade={onUpgrade} />
              </div>
            )}

            {/* リスクレベル - 全ユーザーに表示 */}
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

            {/* 重要な要因と推奨事項を横並びに配置 - 全ユーザーに表示 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 重要な要因 */}
              {analysisResult.keyFactors.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">重要な要因</h4>
                  <ul className="space-y-2">
                    {analysisResult.keyFactors.slice(0, isPremium ? undefined : 2).map((factor, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-muted-foreground pl-5 relative before:content-['•'] before:absolute before:left-0 before:text-primary"
                      >
                        {factor}
                      </li>
                    ))}
                    {!isPremium && analysisResult.keyFactors.length > 2 && (
                      <li className="text-sm text-muted-foreground pl-5 flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        他{analysisResult.keyFactors.length - 2}件はプレミアム限定
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* 推奨事項 */}
              {analysisResult.recommendations.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">推奨事項</h4>
                  <ul className="space-y-2">
                    {analysisResult.recommendations.slice(0, isPremium ? undefined : 2).map((rec, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-muted-foreground pl-5 relative before:content-['→'] before:absolute before:left-0 before:text-primary"
                      >
                        {rec}
                      </li>
                    ))}
                    {!isPremium && analysisResult.recommendations.length > 2 && (
                      <li className="text-sm text-muted-foreground pl-5 flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        他{analysisResult.recommendations.length - 2}件はプレミアム限定
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* SWOT分析 - プレミアム限定 */}
            {analysisResult.swot && (
              isPremium ? (
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
              ) : (
                <div>
                  <h4 className="font-bold mb-4 text-base flex items-center gap-2">
                    📊 SWOT分析
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </h4>
                  <PremiumLock title="SWOT分析" onUpgrade={onUpgrade} />
                </div>
              )
            )}

            {/* AI感想セクション - プレミアム限定 */}
            {analysisResult.aiReflection && (
              isPremium ? (
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
              ) : (
                <div>
                  <h4 className="font-bold mb-4 text-base flex items-center gap-2">
                    🤖 AIの感想
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </h4>
                  <PremiumLock title="AIの感想" onUpgrade={onUpgrade} />
                </div>
              )
            )}

            {/* 無料ユーザー向けアップグレード促進 */}
            {!isPremium && (
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-lg">
                <div className="flex items-center gap-3">
                  <Crown className="h-8 w-8 text-amber-500" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-900">
                      プレミアムで全機能をアンロック
                    </p>
                    <p className="text-sm text-amber-700">
                      目標株価・損切りライン・SWOT分析などの詳細情報を取得
                    </p>
                  </div>
                  <Button
                    onClick={onUpgrade}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                  >
                    アップグレード
                  </Button>
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
            
            {canUse ? (
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
                    {!isPremium && (
                      <span className="ml-2 text-xs opacity-75">
                        (残り{remainingUsage}回)
                      </span>
                    )}
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800 font-medium">
                    本日の無料分析回数（{dailyLimit}回）を使い切りました
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    明日リセットされます。今すぐ分析を続けるにはプレミアムをご検討ください。
                  </p>
                </div>
                <Button
                  onClick={onUpgrade}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  プレミアムにアップグレード
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
