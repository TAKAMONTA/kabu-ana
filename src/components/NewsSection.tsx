"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Brain, TrendingUp, ExternalLink, Lock, Crown } from "lucide-react";
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

export function NewsSection({
  newsAnalysis,
  analyzedNews,
  newsData,
  isNewsAnalyzing,
  onAnalyze,
  isPremium,
  canUse,
  remainingUsage,
  dailyLimit,
  onUpgrade,
}: NewsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5" />
            関連ニュース分析
            {!isPremium && (
              <span className="ml-2 text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                残り{remainingUsage}/{dailyLimit}回
              </span>
            )}
          </CardTitle>
          {canUse ? (
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
        {newsAnalysis ? (
          <div className="space-y-6">
            {/* ニュース影響分析結果 - 基本情報は全ユーザーに表示 */}
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

                {/* 重要なポイント - プレミアム限定 */}
                {newsAnalysis.keyPoints.length > 0 && (
                  isPremium ? (
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
                  ) : (
                    <div className="mb-4">
                      <h5 className="font-semibold text-purple-800 mb-2 text-sm flex items-center gap-2">
                        🔍 重要なポイント
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      </h5>
                      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                        {newsAnalysis.keyPoints.length}件のポイントがあります（プレミアム限定）
                      </div>
                    </div>
                  )
                )}

                {/* 推奨事項 - プレミアム限定 */}
                {newsAnalysis.recommendations.length > 0 && (
                  isPremium ? (
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
                  ) : (
                    <div>
                      <h5 className="font-semibold text-purple-800 mb-2 text-sm flex items-center gap-2">
                        💡 投資家への推奨事項
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      </h5>
                      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                        {newsAnalysis.recommendations.length}件の推奨事項があります（プレミアム限定）
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* 分析されたニュース一覧 - プレミアム限定（全件表示） */}
            {analyzedNews && analyzedNews.length > 0 && (
              <div>
                <h5 className="font-semibold mb-3 text-base flex items-center gap-2">
                  📰 分析対象ニュース ({analyzedNews.length}件)
                  {!isPremium && <Lock className="h-4 w-4 text-muted-foreground" />}
                </h5>
                <div className="space-y-3">
                  {/* 無料ユーザーは2件まで、プレミアムは5件表示 */}
                  {analyzedNews.slice(0, isPremium ? 5 : 2).map((news, idx) => (
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
                  
                  {/* 無料ユーザー向けロック表示 */}
                  {!isPremium && analyzedNews.length > 2 && (
                    <div className="p-3 border-2 border-dashed border-amber-300 rounded-lg bg-amber-50/50">
                      <div className="flex items-center gap-3">
                        <Lock className="h-5 w-5 text-amber-500" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-800">
                            他{analyzedNews.length - 2}件のニュースはプレミアム限定
                          </p>
                        </div>
                        <Button
                          onClick={onUpgrade}
                          size="sm"
                          variant="outline"
                          className="border-amber-400 text-amber-700 hover:bg-amber-100"
                        >
                          全て見る
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 無料ユーザー向けアップグレード促進 */}
            {!isPremium && (
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-lg">
                <div className="flex items-center gap-3">
                  <Crown className="h-6 w-6 text-amber-500" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-900 text-sm">
                      プレミアムで詳細分析を確認
                    </p>
                    <p className="text-xs text-amber-700">
                      重要ポイント・推奨事項・全ニュースなどの詳細情報を取得
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
        ) : newsData && newsData.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              最新ニュースを取得済みです。「関連ニュースをAI分析」ボタンをクリックしてAI分析を実行してください。
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
            {canUse ? (
              <p className="text-sm text-muted-foreground mb-4">
                企業を検索してから、関連ニュースの分析を実行してください
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
