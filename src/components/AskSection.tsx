"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Brain, Send, Lock } from "lucide-react";
import { AnalysisResult } from "@/lib/api/openrouter";

const PRESET_QUESTIONS = [
  { label: "業績", question: "直近の業績はどうですか？" },
  { label: "リスク", question: "主なリスクを教えてください" },
  { label: "割安？", question: "現在の株価は割安ですか？" },
  { label: "変化", question: "最近の事業環境の変化を教えてください" },
  { label: "同業比較", question: "競合他社と比べてどうですか？" },
];

interface AskSectionProps {
  onAsk: (question: string) => void;
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
  onAsk,
  isAnalyzing,
  streamingText,
  analysisResult,
  canUseFeature = true,
  remainingUses = 5,
  dailyLimit = 5,
  isPremium = false,
  currencySymbol = "¥",
}: AskSectionProps) {
  const [freeText, setFreeText] = useState("");
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handlePreset = (question: string) => {
    if (!canUseFeature || isAnalyzing) return;
    setActiveQuestion(question);
    setFreeText("");
    onAsk(question);
  };

  const handleSubmit = () => {
    const q = freeText.trim();
    if (!q || !canUseFeature || isAnalyzing) return;
    setActiveQuestion(q);
    setFreeText("");
    onAsk(q);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasResponse = analysisResult || (isAnalyzing && streamingText);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AIに質問する（参考情報）
        </CardTitle>
        <CardDescription>
          気になる点を選ぶか、自由に入力してください
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* プリセットチップ */}
        <div className="flex flex-wrap gap-2">
          {PRESET_QUESTIONS.map(({ label, question }) => (
            <button
              key={label}
              onClick={() => handlePreset(question)}
              disabled={!canUseFeature || isAnalyzing}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all
                ${
                  !canUseFeature || isAnalyzing
                    ? "opacity-40 cursor-not-allowed border-border text-muted-foreground"
                    : activeQuestion === question && hasResponse
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "border-border hover:border-primary/60 hover:bg-accent text-foreground"
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 自由入力 */}
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!canUseFeature || isAnalyzing}
            placeholder="自由に質問を入力… (Enterで送信)"
            rows={1}
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <Button
            onClick={handleSubmit}
            disabled={!freeText.trim() || !canUseFeature || isAnalyzing}
            size="icon"
            className="shrink-0"
            aria-label="送信"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* 利用状況 */}
        {!isPremium && canUseFeature && (
          <p className="text-xs text-muted-foreground">
            残り {remainingUses}/{dailyLimit} 回
          </p>
        )}

        {!canUseFeature && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
            <Lock className="h-4 w-4 shrink-0" />
            <span>
              本日の利用上限に達しました。プレミアムプランで無制限にご利用いただけます。
            </span>
          </div>
        )}

        {/* 回答エリア */}
        {(isAnalyzing || hasResponse) && (
          <div className="space-y-4 border-t pt-4">
            {activeQuestion && (
              <p className="text-sm">
                <span className="text-muted-foreground mr-1">Q.</span>
                <span className="font-medium">{activeQuestion}</span>
              </p>
            )}

            {(streamingText || isAnalyzing) && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs font-semibold text-slate-500 mb-2 dark:text-slate-400">
                  AIの回答
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

                {analysisResult.keyFactors?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">重要な要因</h4>
                    <ul className="space-y-1.5">
                      {analysisResult.keyFactors.map((f, i) => (
                        <li
                          key={i}
                          className="text-sm text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-primary"
                        >
                          {f}
                        </li>
                      ))}
                    </ul>
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
