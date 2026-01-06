"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Brain, TrendingUp, ExternalLink } from "lucide-react";
import { NewsAnalysisResult } from "@/lib/api/openrouter";

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
  onAnalyze: () => void;
}

export function NewsSection({
  newsAnalysis,
  analyzedNews,
  newsData,
  isNewsAnalyzing,
  onAnalyze,
}: NewsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5" />
            関連ニュース分析
          </CardTitle>
          <Button
            onClick={onAnalyze}
            disabled={isNewsAnalyzing}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isNewsAnalyzing ? (
              <>
                <Brain className="h-4 w-4 mr-2 animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                関連ニュースをAI分析
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {newsAnalysis ? (
          <div className="space-y-6">
            {/* ニュース影響分析結果 */}
            <div className="p-5 bg-gradient-to-r from-purple-50 to-purple-100/50 rounded-lg border-2 border-purple-300 shadow-sm">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-purple-200 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-800" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-bold text-purple-950 text-lg">
                      📈 ニュース影響分析
                    </h4>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-bold ${
                        newsAnalysis.impact === "positive"
                          ? "bg-green-200 text-green-900"
                          : newsAnalysis.impact === "negative"
                          ? "bg-red-200 text-red-900"
                          : "bg-gray-200 text-gray-900"
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
                  <p className="text-sm text-purple-700 mb-3">
                    AIによる最新ニュースの株価影響評価
                  </p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-purple-200 shadow-sm">
                <p className="text-sm text-purple-900 leading-relaxed mb-4">
                  {newsAnalysis.analysis}
                </p>

                {/* 重要なポイント */}
                {newsAnalysis.keyPoints.length > 0 && (
                  <div className="mb-4">
                    <h5 className="font-semibold text-purple-800 mb-2 text-sm">
                      🔍 重要なポイント
                    </h5>
                    <ul className="space-y-1">
                      {newsAnalysis.keyPoints.map((point, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-purple-800 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-purple-600"
                        >
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 推奨事項 */}
                {newsAnalysis.recommendations.length > 0 && (
                  <div>
                    <h5 className="font-semibold text-purple-800 mb-2 text-sm">
                      💡 投資家への推奨事項
                    </h5>
                    <ul className="space-y-1">
                      {newsAnalysis.recommendations.map((rec, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-purple-800 pl-4 relative before:content-['→'] before:absolute before:left-0 before:text-purple-600"
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
                  {analyzedNews.slice(0, 5).map((news, idx) => (
                    <a
                      key={idx}
                      href={news.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 border rounded-lg hover:bg-accent transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">
                            {news.title || news.snippet}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                              {news.source}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {news.date}
                            </span>
                          </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : newsData && newsData.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              最新ニュースを取得済みです。「関連ニュースを取得」ボタンをクリックしてAI分析を実行してください。
            </p>
            {newsData.slice(0, 3).map((news, idx) => (
              <a
                key={idx}
                href={news.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 border rounded-lg hover:bg-accent transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">
                      {news.snippet}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        {news.source}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {news.date}
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              企業を検索してから、関連ニュースの分析を実行してください
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

