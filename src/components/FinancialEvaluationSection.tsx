"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Brain, Lock, Crown } from "lucide-react";
import { FinancialEvaluationResult } from "@/lib/api/openrouter";

interface FinancialEvaluationSectionProps {
  financialEval: FinancialEvaluationResult | null;
  isFinancialLoading: boolean;
  onEvaluate: () => void;
  getScoreLabel: (score: number) => string;
  getScoreColor: (score: number) => string;
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
          <Lock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold text-muted-foreground mb-2">
            {title}はプレミアム限定
          </p>
          <Button
            size="sm"
            onClick={onUpgrade}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            <Crown className="h-4 w-4 mr-1" />
            アップグレード
          </Button>
        </div>
      </div>
      <div className="opacity-30 blur-sm pointer-events-none" aria-hidden="true">
        <div className="h-24 bg-muted rounded-lg"></div>
      </div>
    </div>
  );
}

export function FinancialEvaluationSection({
  financialEval,
  isFinancialLoading,
  onEvaluate,
  getScoreLabel,
  getScoreColor,
  isPremium,
  canUse,
  remainingUsage,
  dailyLimit,
  onUpgrade,
}: FinancialEvaluationSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5" />
            財務健全性評価（BS/PL/CF）
            {!isPremium && (
              <span className="ml-2 text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                残り{remainingUsage}/{dailyLimit}回
              </span>
            )}
          </CardTitle>
          {canUse ? (
            <Button
              onClick={onEvaluate}
              disabled={isFinancialLoading}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isFinancialLoading ? (
                <>
                  <Brain className="h-4 w-4 mr-2 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  財務をAI評価
                  {!isPremium && (
                    <span className="ml-1 text-xs opacity-75">
                      ({remainingUsage}回)
                    </span>
                  )}
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={onUpgrade}
              size="sm"
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              <Crown className="h-4 w-4 mr-1" />
              アップグレード
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {financialEval ? (
          <div className="space-y-5">
            {/* 総合評価 - 全ユーザーに表示 */}
            <div className="p-4 border-2 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 border-slate-300">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold">総合評価</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${getScoreColor(
                    financialEval.overall.score
                  )}`}
                >
                  {financialEval.overall.label} -{" "}
                  {getScoreLabel(financialEval.overall.score)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {financialEval.analysis}
              </p>
            </div>

            {/* BS/PL/CF個別評価 - プレミアム限定 */}
            {isPremium ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    label: "BS (貸借対照表)",
                    data: financialEval.bs,
                    color: "blue",
                  },
                  {
                    label: "PL (損益計算書)",
                    data: financialEval.pl,
                    color: "green",
                  },
                  {
                    label: "CF (キャッシュフロー)",
                    data: financialEval.cf,
                    color: "purple",
                  },
                ].map(item => (
                  <div
                    key={item.label}
                    className="p-4 border-2 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{item.label}</span>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-bold ${getScoreColor(
                          item.data.score
                        )}`}
                      >
                        {getScoreLabel(item.data.score)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.data.summary}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
                  BS/PL/CF 個別評価
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </h4>
                <PremiumLock title="個別財務評価" onUpgrade={onUpgrade} />
              </div>
            )}

            {/* 推奨事項 - プレミアム限定 */}
            {financialEval.recommendations?.length > 0 && (
              isPremium ? (
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-3 text-sm">📋 推奨事項</h4>
                  <ul className="space-y-1">
                    {financialEval.recommendations.map((rec, i) => (
                      <li
                        key={i}
                        className="text-sm text-muted-foreground pl-5 relative before:content-['→'] before:absolute before:left-0 before:text-primary"
                      >
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div>
                  <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
                    📋 推奨事項
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </h4>
                  <PremiumLock title="推奨事項" onUpgrade={onUpgrade} />
                </div>
              )
            )}

            {/* 無料ユーザー向けアップグレード促進 */}
            {!isPremium && (
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-lg">
                <div className="flex items-center gap-3">
                  <Crown className="h-6 w-6 text-amber-500" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-900 text-sm">
                      プレミアムで詳細評価を確認
                    </p>
                    <p className="text-xs text-amber-700">
                      BS/PL/CF個別評価・推奨事項などの詳細情報を取得
                    </p>
                  </div>
                  <Button
                    onClick={onUpgrade}
                    size="sm"
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                  >
                    詳細を見る
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            {canUse ? (
              <p className="text-sm text-muted-foreground">
                財務三表（BS/PL/CF）をAIが5段階で評価します。
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-amber-800 font-medium">
                  本日の無料分析回数（{dailyLimit}回）を使い切りました
                </p>
                <Button
                  onClick={onUpgrade}
                  size="sm"
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                >
                  <Crown className="h-4 w-4 mr-1" />
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
