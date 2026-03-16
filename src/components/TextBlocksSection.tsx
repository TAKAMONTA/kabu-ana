"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { FileText, ChevronDown, ChevronUp, Loader2, Brain, AlertCircle } from "lucide-react";
import { EdinetTextBlock } from "@/lib/api/edinetdb";
import { AISummary } from "@/hooks/useTextBlocks";

interface TextBlocksSectionProps {
  edinetCode: string;
  companyName: string;
  textBlocks: EdinetTextBlock[];
  aiSummary: AISummary | null;
  isLoading: boolean;
  isSummarizing: boolean;
  error: string | null;
  onFetchTextBlocks: () => void;
  onSummarize: () => void;
}

function TextBlockItem({ block }: { block: EdinetTextBlock }) {
  const [expanded, setExpanded] = useState(false);
  const content = block.content || "";
  const preview = content.slice(0, 200);
  const hasMore = content.length > 200;

  return (
    <div className="border rounded-lg p-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
        {block.section || block.title || "セクション"}
      </p>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {expanded ? content : preview}
        {!expanded && hasMore && "…"}
      </p>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3" />折りたたむ</>
          ) : (
            <><ChevronDown className="h-3 w-3" />続きを読む</>
          )}
        </button>
      )}
    </div>
  );
}

export function TextBlocksSection({
  edinetCode,
  companyName,
  textBlocks,
  aiSummary,
  isLoading,
  isSummarizing,
  error,
  onFetchTextBlocks,
  onSummarize,
}: TextBlocksSectionProps) {
  const [showRawBlocks, setShowRawBlocks] = useState(false);

  const hasData = textBlocks.length > 0 || aiSummary;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              有報テキスト分析
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              出典: EDINET DB（有価証券報告書）
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {!hasData && (
              <Button
                size="sm"
                variant="outline"
                onClick={onFetchTextBlocks}
                disabled={isLoading}
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" />取得中...</>
                ) : (
                  <><FileText className="h-4 w-4 mr-1" />有報を取得</>
                )}
              </Button>
            )}
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={onSummarize}
              disabled={isSummarizing}
            >
              {isSummarizing ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />要約中...</>
              ) : (
                <><Brain className="h-4 w-4 mr-1" />AIで要約</>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive mb-3">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!hasData && !isLoading && !error && (
          <p className="text-sm text-muted-foreground text-center py-4">
            「有報を取得」または「AIで要約」をクリックして有価証券報告書を分析します。
          </p>
        )}

        {/* AI要約 */}
        {aiSummary && (
          <div className="space-y-4 mb-4">
            {aiSummary.summary && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground mb-1">全体要約</p>
                <p className="text-sm leading-relaxed">{aiSummary.summary}</p>
              </div>
            )}

            {aiSummary.businessModel && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">事業モデル</p>
                <p className="text-sm leading-relaxed">{aiSummary.businessModel}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {aiSummary.investmentPoints && aiSummary.investmentPoints.length > 0 && (
                <div className="p-3 border rounded-lg">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">投資判断のポイント</p>
                  <ul className="space-y-1">
                    {aiSummary.investmentPoints.map((p, i) => (
                      <li key={i} className="text-sm pl-3 relative before:content-['✓'] before:absolute before:left-0 before:text-green-600">
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {aiSummary.keyRisks && aiSummary.keyRisks.length > 0 && (
                <div className="p-3 border rounded-lg">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2">主要リスク</p>
                  <ul className="space-y-1">
                    {aiSummary.keyRisks.map((r, i) => (
                      <li key={i} className="text-sm pl-3 relative before:content-['⚠'] before:absolute before:left-0 before:text-red-500">
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {aiSummary.growthDrivers && aiSummary.growthDrivers.length > 0 && (
              <div className="p-3 border rounded-lg">
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-2">成長ドライバー</p>
                <ul className="flex flex-wrap gap-2">
                  {aiSummary.growthDrivers.map((d, i) => (
                    <li key={i} className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full">
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 生テキストブロック */}
        {textBlocks.length > 0 && (
          <div>
            <button
              onClick={() => setShowRawBlocks(!showRawBlocks)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors"
            >
              {showRawBlocks ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              有報テキスト詳細（{textBlocks.length}セクション）
            </button>

            {showRawBlocks && (
              <div className="space-y-3 mt-2">
                {textBlocks.slice(0, 10).map((block, i) => (
                  <TextBlockItem key={i} block={block} />
                ))}
                {textBlocks.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center">
                    他 {textBlocks.length - 10} セクション
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
