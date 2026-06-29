"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain } from "lucide-react";
import { FinancialEvaluationResult } from "@/lib/api/openrouter";

interface FinancialEvaluationSectionProps {
  financialEval: FinancialEvaluationResult | null;
  isFinancialLoading: boolean;
  getScoreLabel: (score: number) => string;
  getScoreColor: (score: number) => string;
}

export function FinancialEvaluationSection({
  financialEval,
  isFinancialLoading,
  getScoreLabel,
  getScoreColor,
}: FinancialEvaluationSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5" />
            財務健全性評価（BS/PL/CF）
          </CardTitle>
          {isFinancialLoading && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Brain className="h-4 w-4 animate-spin" />
              AIが自動分析中...
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {financialEval?.parseFailed ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            <p className="font-semibold">財務評価を表示できませんでした</p>
            <p className="mt-1 text-muted-foreground">
              {financialEval.analysis ||
                "AIの応答形式を読み取れませんでした。しばらくしてから再度お試しください。"}
            </p>
          </div>
        ) : financialEval ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  label: "BS",
                  data: financialEval.bs,
                  color: "blue",
                },
                {
                  label: "PL",
                  data: financialEval.pl,
                  color: "green",
                },
                {
                  label: "CF",
                  data: financialEval.cf,
                  color: "purple",
                },
              ].map(item => (
                <div key={item.label} className="p-4 border-2 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{item.label}</span>
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

            <div className="p-4 border rounded-lg">
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
              <p className="text-sm text-muted-foreground mb-3">
                {financialEval.analysis}
              </p>
              {financialEval.recommendations?.length > 0 && (
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
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-muted-foreground">
            {isFinancialLoading
              ? "財務三表（BS/PL/CF）をAIが自動評価しています。"
              : "総合AI分析の完了後、財務三表（BS/PL/CF）の評価を自動表示します。"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
