"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search,
  TrendingUp,
  Brain,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useCompanySearch } from "@/hooks/useCompanySearch";
import { useAIAnalysis } from "@/hooks/useAIAnalysis";
import { useAuth } from "@/hooks/useAuth";
import { StockChart } from "@/components/StockChart";
import { AuthModal } from "@/components/AuthModal";
import { StockSidePanel } from "@/components/StockSidePanel";
import { normalizeQuery } from "@/lib/utils/textUtils";
import { useNewsAnalysis } from "@/hooks/useNewsAnalysis";
import { useFinancialEvaluation } from "@/hooks/useFinancialEvaluation";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [chartPeriod, setChartPeriod] = useState("1M");
  const [shouldAutoAnalyze, setShouldAutoAnalyze] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const { isLoading, error, searchResult, searchCompany } = useCompanySearch();
  const {
    isAnalyzing,
    error: analysisError,
    analysisResult,
    analyzeStock,
  } = useAIAnalysis();
  const { user, logout } = useAuth();
  const {
    isLoading: isNewsAnalyzing,
    error: newsError,
    newsData: analyzedNews,
    analysis: newsAnalysis,
    analyzeNews,
    clearAnalysis,
  } = useNewsAnalysis();
  const {
    isLoading: isFinancialLoading,
    error: financialError,
    result: financialEval,
    evaluate: evaluateFinancials,
  } = useFinancialEvaluation();

  // 検索結果が更新された時に自動分析を実行
  useEffect(() => {
    if (searchResult && shouldAutoAnalyze && !isAnalyzing) {
      analyzeStock(
        searchResult.companyInfo,
        searchResult.stockData,
        searchResult.newsData
      );
      setShouldAutoAnalyze(false);
    }
  }, [searchResult, shouldAutoAnalyze, isAnalyzing, analyzeStock]);

  const handleSearchAndAnalyze = async () => {
    if (!searchQuery.trim()) return;
    const normalizedQuery = normalizeQuery(searchQuery);

    // 自動分析フラグを設定
    setShouldAutoAnalyze(true);

    // 検索を実行
    await searchCompany(normalizedQuery, chartPeriod);
  };

  const handleAnalyze = async () => {
    if (!searchResult) return;
    await analyzeStock(
      searchResult.companyInfo,
      searchResult.stockData,
      searchResult.newsData
    );
  };

  const getCurrencySymbol = () => {
    if (!searchResult) return "$";
    return searchResult.companyInfo.market === "TYO" ? "¥" : "$";
  };

  const handleChartPeriodChange = async (period: string) => {
    setChartPeriod(period);
    if (searchResult) {
      // 自動分析フラグを設定
      setShouldAutoAnalyze(true);
      await searchCompany(searchResult.companyInfo.symbol, period);
    }
  };

  const handleNewsAnalysis = async () => {
    if (!searchResult) return;
    await analyzeNews(
      searchResult.companyInfo.symbol,
      searchResult.companyInfo.name
    );
  };

  const handleFinancialEvaluation = async () => {
    if (!searchResult) return;
    await evaluateFinancials({
      symbol: searchResult.companyInfo.symbol,
      companyName: searchResult.companyInfo.name,
      financialData: searchResult.financialData,
    });
  };

  const getScoreLabel = (score: number) => {
    switch (score) {
      case 5:
        return "非常に優秀";
      case 4:
        return "優秀";
      case 3:
        return "標準";
      case 2:
        return "やや劣る";
      case 1:
        return "劣る";
      default:
        return "標準";
    }
  };

  const getScoreColor = (score: number) => {
    switch (score) {
      case 5:
        return "text-green-700 bg-green-100";
      case 4:
        return "text-blue-700 bg-blue-100";
      case 3:
        return "text-gray-700 bg-gray-100";
      case 2:
        return "text-orange-700 bg-orange-100";
      case 1:
        return "text-red-700 bg-red-100";
      default:
        return "text-gray-700 bg-gray-100";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">
                AI Market Analyzer
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    {user.email}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => logout()}>
                    ログアウト
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAuthModal(true)}
                >
                  ログイン
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-6">
        {/* 検索セクション */}
        <div className="mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label htmlFor="search" className="sr-only">
                    企業検索
                  </Label>
                  <Input
                    id="search"
                    placeholder="証券コード、ティッカーシンボル、または企業名で検索（例: 7203, AAPL, トヨタ自動車）"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyPress={e =>
                      e.key === "Enter" && handleSearchAndAnalyze()
                    }
                    className="h-11"
                  />
                </div>
                <Button
                  onClick={handleSearchAndAnalyze}
                  disabled={!searchQuery.trim() || isLoading || isAnalyzing}
                  size="lg"
                  className="px-8"
                >
                  <Brain className="h-4 w-4 mr-2" />
                  {isLoading
                    ? "検索中..."
                    : isAnalyzing
                    ? "分析中..."
                    : "検索&分析"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* エラー表示 */}
        {(error || analysisError || newsError) && (
          <Card className="mb-6 border-destructive bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 text-destructive">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">エラーが発生しました</p>
                  <p className="text-sm mt-1">
                    {error || analysisError || newsError}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 検索結果がない場合 */}
        {!searchResult ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <Card>
                <CardContent className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg text-muted-foreground">
                      株式を検索して分析を開始してください
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="md:col-span-1">
              <Card>
                <CardContent className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">
                      企業情報がここに表示されます
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* チャート部分（左側 - 3カラム） */}
            <div className="lg:col-span-3">
              <div className="space-y-6">
                {/* チャートセクション */}
                <StockChart
                  symbol={searchResult.companyInfo.symbol}
                  data={searchResult.chartData}
                  isLoading={isLoading}
                  currency={getCurrencySymbol()}
                  onPeriodChange={handleChartPeriodChange}
                />

                {/* 会社概要セクション */}
                {searchResult.companyInfo.description && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">会社概要</CardTitle>
                        <button
                          onClick={() =>
                            setIsDescriptionExpanded(!isDescriptionExpanded)
                          }
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isDescriptionExpanded ? (
                            <>
                              <ChevronUp className="h-3 w-3" />
                              折りたたむ
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3" />
                              続きを読む
                            </>
                          )}
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p
                        className={`text-sm text-muted-foreground leading-relaxed ${
                          isDescriptionExpanded ? "" : "line-clamp-10"
                        }`}
                      >
                        {searchResult.companyInfo.description}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* AI分析セクション */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      AI投資分析
                    </CardTitle>
                    <CardDescription>
                      AIが企業の投資価値を分析し、投資判断をサポートします
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analysisResult ? (
                      <div className="space-y-6">
                        {/* 投資アドバイス */}
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

                        {/* 目標株価 */}
                        <div>
                          <h4 className="font-bold mb-4 text-base">
                            🎯 目標株価
                          </h4>
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
                                  {getCurrencySymbol()}
                                  {target.value.toLocaleString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 損切りライン */}
                        <div>
                          <h4 className="font-bold mb-4 text-base">
                            ⚠️ 損切りライン
                          </h4>
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
                                  {getCurrencySymbol()}
                                  {target.value.toLocaleString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* リスクレベル */}
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

                        {/* 重要な要因と推奨事項を横並びに配置 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* 重要な要因 */}
                          {analysisResult.keyFactors.length > 0 && (
                            <div>
                              <h4 className="font-semibold mb-3">重要な要因</h4>
                              <ul className="space-y-2">
                                {analysisResult.keyFactors.map(
                                  (factor, idx) => (
                                    <li
                                      key={idx}
                                      className="text-sm text-muted-foreground pl-5 relative before:content-['•'] before:absolute before:left-0 before:text-primary"
                                    >
                                      {factor}
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>
                          )}

                          {/* 推奨事項 */}
                          {analysisResult.recommendations.length > 0 && (
                            <div>
                              <h4 className="font-semibold mb-3">推奨事項</h4>
                              <ul className="space-y-2">
                                {analysisResult.recommendations.map(
                                  (rec, idx) => (
                                    <li
                                      key={idx}
                                      className="text-sm text-muted-foreground pl-5 relative before:content-['→'] before:absolute before:left-0 before:text-primary"
                                    >
                                      {rec}
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* SWOT分析 */}
                        {analysisResult.swot && (
                          <div>
                            <h4 className="font-bold mb-4 text-base">
                              📊 SWOT分析
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                              {/* 強み (Strengths) */}
                              <div className="p-4 border-2 rounded-lg bg-gradient-to-br from-green-50 to-green-100 border-green-300">
                                <h5 className="font-bold text-green-900 mb-3 text-sm">
                                  ✅ 強み (Strengths)
                                </h5>
                                <ul className="space-y-2">
                                  {analysisResult.swot.strengths.map(
                                    (item, idx) => (
                                      <li
                                        key={idx}
                                        className="text-xs text-green-800 pl-3 relative before:content-['✓'] before:absolute before:left-0 before:font-bold"
                                      >
                                        {item}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>

                              {/* 弱み (Weaknesses) */}
                              <div className="p-4 border-2 rounded-lg bg-gradient-to-br from-red-50 to-red-100 border-red-300">
                                <h5 className="font-bold text-red-900 mb-3 text-sm">
                                  ⚠️ 弱み (Weaknesses)
                                </h5>
                                <ul className="space-y-2">
                                  {analysisResult.swot.weaknesses.map(
                                    (item, idx) => (
                                      <li
                                        key={idx}
                                        className="text-xs text-red-800 pl-3 relative before:content-['×'] before:absolute before:left-0 before:font-bold"
                                      >
                                        {item}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>

                              {/* 機会 (Opportunities) */}
                              <div className="p-4 border-2 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300">
                                <h5 className="font-bold text-blue-900 mb-3 text-sm">
                                  💡 機会 (Opportunities)
                                </h5>
                                <ul className="space-y-2">
                                  {analysisResult.swot.opportunities.map(
                                    (item, idx) => (
                                      <li
                                        key={idx}
                                        className="text-xs text-blue-800 pl-3 relative before:content-['→'] before:absolute before:left-0 before:font-bold"
                                      >
                                        {item}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>

                              {/* 脅威 (Threats) */}
                              <div className="p-4 border-2 rounded-lg bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300">
                                <h5 className="font-bold text-yellow-900 mb-3 text-sm">
                                  🚨 脅威 (Threats)
                                </h5>
                                <ul className="space-y-2">
                                  {analysisResult.swot.threats.map(
                                    (item, idx) => (
                                      <li
                                        key={idx}
                                        className="text-xs text-yellow-800 pl-3 relative before:content-['⚡'] before:absolute before:left-0 before:font-bold"
                                      >
                                        {item}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* AI感想セクション */}
                        {analysisResult.aiReflection && (
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
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground mb-4">
                          この企業を詳しく分析してみましょう
                        </p>
                        <Button
                          onClick={handleAnalyze}
                          disabled={!searchResult || isAnalyzing}
                          className="w-full"
                        >
                          {isAnalyzing ? (
                            <>
                              <Brain className="h-4 w-4 mr-2 animate-spin" />
                              再分析中...
                            </>
                          ) : (
                            <>
                              <Brain className="h-4 w-4 mr-2" />
                              再分析する
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 財務健全性（BS/PL/CF）評価 */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Brain className="h-5 w-5" />
                        財務健全性評価（BS/PL/CF）
                      </CardTitle>
                      <Button
                        onClick={handleFinancialEvaluation}
                        disabled={!searchResult || isFinancialLoading}
                        size="sm"
                        variant="outline"
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
                              className={`p-4 border-2 rounded-lg bg-gradient-to-br from-${""} to-${""}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold">
                                  {item.label}
                                </span>
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
                            <span className="text-sm font-semibold">
                              総合評価
                            </span>
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

                {/* ニュースセクション */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Brain className="h-5 w-5" />
                        関連ニュース分析
                      </CardTitle>
                      <Button
                        onClick={handleNewsAnalysis}
                        disabled={!searchResult || isNewsAnalyzing}
                        size="sm"
                        variant="outline"
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
                                  {newsAnalysis.recommendations.map(
                                    (rec, idx) => (
                                      <li
                                        key={idx}
                                        className="text-xs text-purple-800 pl-4 relative before:content-['→'] before:absolute before:left-0 before:text-purple-600"
                                      >
                                        {rec}
                                      </li>
                                    )
                                  )}
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
                    ) : searchResult.newsData &&
                      searchResult.newsData.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground mb-4">
                          最新ニュースを取得済みです。「関連ニュースを取得」ボタンをクリックしてAI分析を実行してください。
                        </p>
                        {searchResult.newsData.slice(0, 3).map((news, idx) => (
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
              </div>
            </div>

            {/* サイドパネル（右側 - 1カラム） */}
            <div className="lg:col-span-1">
              <StockSidePanel
                companyInfo={searchResult.companyInfo}
                stockData={searchResult.stockData}
                financialData={searchResult.financialData}
                currency={getCurrencySymbol()}
              />
            </div>
          </div>
        )}

        {/* フッター広告セクション */}
        <div className="mt-12 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg border-2 border-orange-300 p-6">
          <div className="text-center">
            <p className="text-sm text-orange-600 font-semibold mb-3">
              スポンサー
            </p>
            <a
              href="https://px.a8.net/svt/ejp?a8mat=45FV1Z+56CP4I+1WP2+6G4HD"
              rel="nofollow"
            >
              <Image
                width={250}
                height={250}
                alt=""
                src="https://www24.a8.net/svt/bgt?aid=251002871313&wid=001&eno=01&mid=s00000008903001083000&mc=1"
                style={{ border: "0" }}
              />
            </a>
            <Image
              width={1}
              height={1}
              src="https://www17.a8.net/0.gif?a8mat=45FV1Z+56CP4I+1WP2+6G4HD"
              alt=""
              style={{ border: "0" }}
            />
          </div>
        </div>
      </main>

      {/* 認証モーダル */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}
