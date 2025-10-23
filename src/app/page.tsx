"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { useCompanySearch } from "@/hooks/useCompanySearch";
import { useAIAnalysis } from "@/hooks/useAIAnalysis";
import { useAuth } from "@/hooks/useAuth";
import { StockChart } from "@/components/StockChart";
import { AuthModal } from "@/components/AuthModal";
import { StockSidePanel } from "@/components/StockSidePanel";
import { normalizeQuery } from "@/lib/utils/textUtils";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [chartPeriod, setChartPeriod] = useState("1M");
  const [shouldAutoAnalyze, setShouldAutoAnalyze] = useState(false);
  const { isLoading, error, searchResult, searchCompany } = useCompanySearch();
  const {
    isAnalyzing,
    error: analysisError,
    analysisResult,
    analyzeStock,
  } = useAIAnalysis();
  const { user, logout } = useAuth();

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
        {(error || analysisError) && (
          <Card className="mb-6 border-destructive bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 text-destructive">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">エラーが発生しました</p>
                  <p className="text-sm mt-1">{error || analysisError}</p>
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
                        <div className="p-5 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-lg border-2 border-blue-300 shadow-sm">
                          <h4 className="font-bold text-blue-950 mb-3 text-base">
                            📊 投資アドバイス
                          </h4>
                          <p className="text-sm text-blue-900 leading-relaxed">
                            {analysisResult.investmentAdvice}
                          </p>
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

                        {/* 重要な要因 */}
                        {analysisResult.keyFactors.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-3">重要な要因</h4>
                            <ul className="space-y-2">
                              {analysisResult.keyFactors.map((factor, idx) => (
                                <li
                                  key={idx}
                                  className="text-sm text-muted-foreground pl-5 relative before:content-['•'] before:absolute before:left-0 before:text-primary"
                                >
                                  {factor}
                                </li>
                              ))}
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

                {/* 広告セクション */}
                <Card className="bg-gradient-to-r from-indigo-50 to-indigo-100 border-indigo-300">
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <p className="text-sm text-indigo-600 font-semibold mb-2">
                        広告
                      </p>
                      <div className="bg-indigo-200 rounded-lg p-6 border-2 border-indigo-400">
                        <a
                          href="https://px.a8.net/svt/ejp?a8mat=45FV1Z+56CP4I+1WP2+6G4HD"
                          rel="nofollow"
                        >
                          <img
                            width="250"
                            height="250"
                            alt=""
                            src="https://www24.a8.net/svt/bgt?aid=251002871313&wid=001&eno=01&mid=s00000008903001083000&mc=1"
                            style={{ border: "0" }}
                          />
                        </a>
                        <img
                          width="1"
                          height="1"
                          src="https://www17.a8.net/0.gif?a8mat=45FV1Z+56CP4I+1WP2+6G4HD"
                          alt=""
                          style={{ border: "0" }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ニュースセクション */}
                {searchResult.newsData && searchResult.newsData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">最新ニュース</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {searchResult.newsData.slice(0, 5).map((news, idx) => (
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
                    </CardContent>
                  </Card>
                )}
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
              <img
                width="250"
                height="250"
                alt=""
                src="https://www24.a8.net/svt/bgt?aid=251002871313&wid=001&eno=01&mid=s00000008903001083000&mc=1"
                style={{ border: "0" }}
              />
            </a>
            <img
              width="1"
              height="1"
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
