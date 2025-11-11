"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Brain } from "lucide-react";
import { FinancialEvaluationResult } from "@/lib/api/openrouter";

interface FinancialEvaluationSectionProps {
  financialEval: FinancialEvaluationResult | null;
  isFinancialLoading: boolean;
  onEvaluate: () => void;
  getScoreLabel: (score: number) => string;
  getScoreColor: (score: number) => string;
}

export function FinancialEvaluationSection({
  financialEval,
  isFinancialLoading,
  onEvaluate,
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
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {financialEval ? (
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
                <div
                  key={item.label}
                  className="p-4 border-2 rounded-lg"
                >
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
            財務三表（BS/PL/CF）をAIが5段階で評価します。
          </div>
        )}
      </CardContent>
    </Card>
  );
}

