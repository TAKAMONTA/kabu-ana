"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Brain, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { AnalysisResult } from "@/lib/api/openrouter";
import { splitNarrativeAndJson } from "@/lib/api/analysisStream";

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

const COMMENT_PREVIEW_LENGTH = 260;
const CONCLUSION_MAX_LENGTH = 100;

function getConclusion(analysisResult: AnalysisResult | null): string | null {
  const conclusion = analysisResult?.analysisConclusion?.trim();
  if (!conclusion) return null;
  if (conclusion.length <= CONCLUSION_MAX_LENGTH) return conclusion;
  return `${conclusion.slice(0, CONCLUSION_MAX_LENGTH)}…`;
}

function getMainAnalysisText(
  streamingText: string,
  analysisResult: AnalysisResult | null
): string {
  const narrative = splitNarrativeAndJson(streamingText).narrative;
  if (narrative) return narrative;
  return analysisResult?.investmentAdvice || "";
}

function splitSentences(text: string): string[] {
  // 小数点（例: 48.4）を文の区切りと誤認しないよう、一時的に退避してから分割する
  const DECIMAL_PLACEHOLDER = "\u0001";
  const protectedText = text
    .replace(/\s+/g, " ")
    .replace(/(\d)\.(\d)/g, `$1${DECIMAL_PLACEHOLDER}$2`);
  return (
    protectedText
      .match(/[^。.!?！？]+[。.!?！？]?/g)
      ?.map(sentence =>
        sentence.replace(new RegExp(DECIMAL_PLACEHOLDER, "g"), ".").trim()
      )
      .filter(Boolean) ?? []
  );
}

function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

function sentencesOverlap(a: string, b: string): boolean {
  const normA = normalizeForCompare(a);
  const normB = normalizeForCompare(b);
  if (!normA || !normB) return false;
  const probe = normA.slice(0, Math.min(24, normA.length));
  return normB.includes(probe) || normA.includes(normB.slice(0, Math.min(24, normB.length)));
}

function getCommentBody(
  text: string,
  analysisResult: AnalysisResult | null
): string {
  const conclusion = analysisResult?.analysisConclusion?.trim() || "";
  const advice = analysisResult?.investmentAdvice?.trim() || "";

  // ストリーミング本文を優先し、無ければ補足コメントを使う
  let body = text.trim() || advice;
  if (!body) return "";

  // 結論は別枠で表示するため、結論と重複する文のみを取り除く。
  // 文章の先頭を無条件に削らないことで「数字の途中から始まる」表示崩れを防ぐ。
  if (conclusion) {
    const sentences = splitSentences(body);
    const filtered = sentences.filter(
      sentence => !sentencesOverlap(sentence, conclusion)
    );
    if (filtered.length > 0 && filtered.length < sentences.length) {
      body = filtered.join("").trim();
    }
  }

  return body;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}

function riskLabel(level: AnalysisResult["riskLevel"]) {
  switch (level) {
    case "low":
      return "低リスク";
    case "medium":
      return "中リスク";
    case "high":
      return "高リスク";
    default:
      return level;
  }
}

function riskClassName(level: AnalysisResult["riskLevel"]) {
  switch (level) {
    case "low":
      return "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200";
    case "medium":
      return "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200";
    case "high":
      return "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200";
  }
}

function buildPointCards(analysisResult: AnalysisResult | null) {
  const keyFactors = analysisResult?.keyFactors ?? [];
  const recommendations = analysisResult?.recommendations ?? [];
  const swot = analysisResult?.swot;

  return [
    {
      label: "良い点",
      value:
        swot?.strengths?.[0] ||
        keyFactors[0] ||
        "業績や材料の強みをAIが整理します。",
      className:
        "border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100",
    },
    {
      label: "注意点",
      value:
        swot?.threats?.[0] ||
        swot?.weaknesses?.[0] ||
        keyFactors[1] ||
        "株価や事業に影響しそうなリスクを確認します。",
      className:
        "border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
    },
    {
      label: "次に見る点",
      value:
        recommendations[0] ||
        swot?.opportunities?.[0] ||
        keyFactors[2] ||
        "決算、ニュース、株価材料を続けて確認します。",
      className:
        "border-sky-200 bg-sky-50/80 text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100",
    },
  ];
}

function LoadingDots() {
  return (
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
  );
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
  const [showDetails, setShowDetails] = useState(false);
  const [showFullComment, setShowFullComment] = useState(false);

  const mainText = getMainAnalysisText(streamingText, analysisResult);
  const hasResponse =
    analysisResult || isAnalyzing || Boolean(mainText.trim());
  const conclusion = getConclusion(analysisResult);
  const commentBody = getCommentBody(mainText, analysisResult) || mainText;
  const shouldCollapseComment = commentBody.length > COMMENT_PREVIEW_LENGTH;
  const visibleComment = showFullComment
    ? commentBody
    : truncateText(commentBody, COMMENT_PREVIEW_LENGTH);
  const pointCards = buildPointCards(analysisResult);
  const keyFactors = analysisResult?.keyFactors ?? [];
  const hasMoreDetails = Boolean(
    analysisResult &&
      (keyFactors.length > 0 ||
        (analysisResult.recommendations?.length ?? 0) > 0 ||
        analysisResult.swot ||
        analysisResult.targetPrice ||
        analysisResult.stopLoss ||
        analysisResult.aiReflection)
  );

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-primary" />
              無料AI分析レポート
            </CardTitle>
            <CardDescription>
              検索だけで、業績・材料・リスクをAIが自動整理します。
            </CardDescription>
          </div>
          {!isPremium && canUseFeature && (
            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              本日あと {remainingUses} 回
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!canUseFeature && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-900">
            <Lock className="h-4 w-4 shrink-0" />
            <span>
              本日の無料AI分析上限に達しました。プレミアムプランで無制限にご利用いただけます。
            </span>
          </div>
        )}

        {hasResponse && (
          <div className="space-y-4">
            {(mainText || isAnalyzing) && (
              <div className="rounded-xl border border-slate-200 bg-card p-4 dark:border-slate-800">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">根拠とAIの見立て</p>
                  {analysisResult?.riskLevel && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${riskClassName(
                          analysisResult.riskLevel
                        )}`}
                      >
                        {riskLabel(analysisResult.riskLevel)}
                      </span>
                      {analysisResult.confidence != null && (
                        <span className="text-xs text-muted-foreground">
                          信頼度 {analysisResult.confidence}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {mainText ? visibleComment : "数字から見立てを整理しています"}
                  {isAnalyzing && !mainText && <LoadingDots />}
                  {isAnalyzing && mainText && <span className="animate-pulse">▋</span>}
                </p>
                {shouldCollapseComment && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-auto px-0 text-primary hover:bg-transparent hover:text-primary/80"
                    onClick={() => setShowFullComment(prev => !prev)}
                  >
                    {showFullComment ? "短く表示" : "全文を読む"}
                  </Button>
                )}
              </div>
            )}

            {(conclusion || (isAnalyzing && mainText)) && (
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  結論
                </p>
                <p className="text-base font-semibold leading-relaxed text-foreground md:text-lg">
                  {conclusion ?? "結論をまとめています"}
                  {isAnalyzing && !conclusion && <LoadingDots />}
                </p>
              </div>
            )}

            {analysisResult && (
              <>
                <div>
                  <h4 className="mb-3 text-sm font-semibold">見るべきポイント</h4>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {pointCards.map(point => (
                      <div
                        key={point.label}
                        className={`rounded-xl border p-3 ${point.className}`}
                      >
                        <p className="mb-2 text-xs font-bold">{point.label}</p>
                        <p className="text-sm leading-relaxed">{point.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                  本分析は情報提供を目的とした参考情報であり、投資助言・売買推奨ではありません。最終的な判断はご自身で行ってください。
                </div>

                {hasMoreDetails && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                    onClick={() => setShowDetails(prev => !prev)}
                  >
                    {showDetails ? (
                      <>
                        <ChevronUp className="mr-2 h-4 w-4" />
                        詳細を閉じる
                      </>
                    ) : (
                      <>
                        <ChevronDown className="mr-2 h-4 w-4" />
                        詳しく見る（根拠・リスク・SWOT）
                      </>
                    )}
                  </Button>
                )}

                {showDetails && analysisResult && (
                  <div className="space-y-4 border-t pt-4">
                    {keyFactors.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-sm font-semibold">
                          根拠・重要な要因
                        </h4>
                        <ul className="space-y-1.5">
                          {keyFactors.map((factor, i) => (
                            <li
                              key={i}
                              className="relative pl-4 text-sm text-muted-foreground before:absolute before:left-0 before:text-primary before:content-['•']"
                            >
                              {factor}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysisResult.recommendations?.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-sm font-semibold">
                          次に確認すること
                        </h4>
                        <ul className="space-y-1.5">
                          {analysisResult.recommendations.map((rec, i) => (
                            <li
                              key={i}
                              className="relative pl-5 text-sm text-muted-foreground before:absolute before:left-0 before:text-primary before:content-['→']"
                            >
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysisResult.targetPrice && (
                      <div>
                        <h4 className="mb-2 text-sm font-bold">
                          参考レンジ（売買推奨ではありません）
                        </h4>
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
                              className="rounded-lg border border-green-300 bg-gradient-to-br from-green-50 to-green-100 p-3 text-center dark:border-green-800 dark:from-green-950 dark:to-green-900"
                            >
                              <p className="mb-1 text-xs font-bold text-green-700 dark:text-green-300">
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
                        <h4 className="mb-2 text-sm font-bold">
                          下振れリスク目安（参考）
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
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
                          ].map(t => (
                            <div
                              key={t.label}
                              className="rounded-lg border border-red-300 bg-gradient-to-br from-red-50 to-red-100 p-3 text-center dark:border-red-800 dark:from-red-950 dark:to-red-900"
                            >
                              <p className="mb-1 text-xs font-bold text-red-700 dark:text-red-300">
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

                    {analysisResult.swot && (
                      <div>
                        <h4 className="mb-3 text-sm font-bold">SWOT分析</h4>
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
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                        <h4 className="mb-2 text-sm font-semibold">AIの見立て</h4>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {analysisResult.aiReflection}
                        </p>
                      </div>
                    )}
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
