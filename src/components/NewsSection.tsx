"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, ExternalLink } from "lucide-react";
import { NewsAnalysisResult } from "@/lib/api/openrouter";
import { normalizeDisplayText } from "@/lib/displayText";

interface NewsItem {
  title?: string;
  snippet: string;
  link: string;
  source: string;
  date: string;
}

interface NewsSectionProps {
  newsAnalysis: NewsAnalysisResult | null;
  analyzedNews: NewsItem[] | null;
  newsData: NewsItem[] | null;
  isNewsAnalyzing: boolean;
  newsError?: string | null;
  newsEmpty?: boolean;
  onRetryNews?: () => void;
}

export function NewsSection({
  newsAnalysis,
  analyzedNews,
  newsData,
  isNewsAnalyzing,
  newsError,
  newsEmpty = false,
  onRetryNews,
}: NewsSectionProps) {
  const renderNewsCard = (news: NewsItem, idx: number) => {
    const title = normalizeDisplayText(news.title || news.snippet);
    const snippet = normalizeDisplayText(news.snippet);
    const source = normalizeDisplayText(news.source);
    const date = normalizeDisplayText(news.date);
    const showSnippet = snippet.length > 0 && snippet !== title;

    return (
      <a
        key={news.link || idx}
        href={news.link}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg border p-3 transition-colors hover:bg-accent group"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium transition-colors group-hover:text-primary">
              {title}
            </p>
            {showSnippet && (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {snippet}
              </p>
            )}
            <div className="mt-2 flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
              <span className="truncate">情報源: {source}</span>
              {date && <span className="shrink-0">{date}</span>}
            </div>
          </div>
          <ExternalLink className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
        </div>
      </a>
    );
  };
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5" />
            関連ニュース分析
          </CardTitle>
          {isNewsAnalyzing && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Brain className="h-4 w-4 animate-spin" />
              AIが自動分析中...
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {newsError && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <p className="font-semibold">ニュース分析を取得できませんでした</p>
            <p className="mt-1 text-destructive/80">{newsError}</p>
            {onRetryNews && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={onRetryNews}
              >
                再試行
              </Button>
            )}
          </div>
        )}
        {newsAnalysis?.parseFailed ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            <p className="font-semibold">ニュース影響分析を表示できませんでした</p>
            <p className="mt-1 text-muted-foreground">
              {newsAnalysis.analysis ||
                "AIの応答形式を読み取れませんでした。しばらくしてから再度お試しください。"}
            </p>
            {onRetryNews && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900"
                onClick={onRetryNews}
              >
                再試行
              </Button>
            )}
          </div>
        ) : newsAnalysis ? (
          <div className="space-y-6">
            {/* ニュース影響分析結果 */}
            <div className="p-5 bg-gradient-to-r from-purple-50 to-purple-100/50 rounded-lg border-2 border-purple-300 shadow-sm dark:from-purple-950 dark:to-purple-900/50 dark:border-purple-800">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-purple-200 rounded-lg dark:bg-purple-900">
                  <TrendingUp className="h-5 w-5 text-purple-800 dark:text-purple-200" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-bold text-purple-950 text-lg dark:text-purple-100">
                      📈 ニュース影響分析
                    </h4>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-bold ${
                        newsAnalysis.impact === "positive"
                          ? "bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-200"
                          : newsAnalysis.impact === "negative"
                            ? "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200"
                            : "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-200"
                      }`}
                    >
                      {newsAnalysis.impact === "positive"
                        ? "📈 ポジティブ"
                        : newsAnalysis.impact === "negative"
                          ? "📉 ネガティブ"
                          : "➡️ ニュートラル"}
                      ({newsAnalysis.impactScore > 0 ? "+" : ""}
                      {newsAnalysis.impactScore})
                    </span>
                  </div>
                  <p className="text-sm text-purple-700 mb-3 dark:text-purple-300">
                    AIによる最新ニュースの材料整理
                  </p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-purple-200 shadow-sm dark:bg-card dark:border-purple-800">
                <p className="text-sm text-purple-900 leading-relaxed mb-4 dark:text-purple-200">
                  {newsAnalysis.analysis}
                </p>

                {/* 重要なポイント */}
                {newsAnalysis.keyPoints.length > 0 && (
                  <div className="mb-4">
                    <h5 className="font-semibold text-purple-800 mb-2 text-sm dark:text-purple-200">
                      🔍 重要なポイント
                    </h5>
                    <ul className="space-y-1">
                      {newsAnalysis.keyPoints.map((point, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-purple-800 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-purple-600 dark:text-purple-200 dark:before:text-purple-400"
                        >
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 確認ポイント */}
                {newsAnalysis.recommendations.length > 0 && (
                  <div>
                    <h5 className="font-semibold text-purple-800 mb-2 text-sm dark:text-purple-200">
                      💡 確認ポイント
                    </h5>
                    <ul className="space-y-1">
                      {newsAnalysis.recommendations.map((rec, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-purple-800 pl-4 relative before:content-['→'] before:absolute before:left-0 before:text-purple-600 dark:text-purple-200 dark:before:text-purple-400"
                        >
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* 分析されたニュース一覧 */}
            {analyzedNews && analyzedNews.length > 0 && (
              <div>
                <h5 className="font-semibold mb-3 text-base">
                  📰 分析対象ニュース ({analyzedNews.length}件)
                </h5>
                <div className="space-y-3">
                  {analyzedNews.slice(0, 5).map(renderNewsCard)}
                </div>
              </div>
            )}
          </div>
        ) : newsEmpty ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-900">
            <p>この銘柄に関する最新ニュースは見つかりませんでした。</p>
            <p className="mt-1 text-xs">
              ニュースが無いため、影響分析はスキップされます。
            </p>
          </div>
        ) : newsData && newsData.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              総合AI分析の完了後、関連ニュースの材料整理を自動表示します。
            </p>
            {newsData.slice(0, 3).map(renderNewsCard)}
          </div>
        ) : (
          <div className="text-center py-8">
            <Brain
              className={`h-12 w-12 mx-auto mb-3 ${
                isNewsAnalyzing
                  ? "animate-spin text-primary"
                  : "text-muted-foreground"
              }`}
            />
            <p className="text-sm text-muted-foreground mb-4">
              {isNewsAnalyzing
                ? "関連ニュースをAIが自動分析しています。"
                : "総合AI分析の完了後、関連ニュース分析を自動表示します。"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
