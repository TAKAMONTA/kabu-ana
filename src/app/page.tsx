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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  TrendingUp,
  BarChart3,
  Brain,
  AlertCircle,
} from "lucide-react";
import { useCompanySearch } from "@/hooks/useCompanySearch";
import { useAIAnalysis } from "@/hooks/useAIAnalysis";
import { useAuth } from "@/hooks/useAuth";
import { StockChart } from "@/components/StockChart";
import { AuthModal } from "@/components/AuthModal";
import { normalizeQuery } from "@/lib/utils/textUtils";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [chartPeriod, setChartPeriod] = useState("1M");
  const { isLoading, error, searchResult, searchCompany } = useCompanySearch();
  const {
    isAnalyzing,
    error: analysisError,
    analysisResult,
    analyzeStock,
  } = useAIAnalysis();
  const { user, logout } = useAuth();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    // 全角→半角変換してから検索
    const normalizedQuery = normalizeQuery(searchQuery);
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

  // 通貨記号を取得
  const getCurrencySymbol = () => {
    if (!searchResult) return "$";
    // 日本の取引所（TYO）の場合は円記号、それ以外はドル記号
    return searchResult.companyInfo.market === "TYO" ? "¥" : "$";
  };

  // チャート期間変更時にデータを再取得
  const handleChartPeriodChange = async (period: string) => {
    setChartPeriod(period);
    if (searchResult) {
      // 期間を変更してデータを再取得
      await searchCompany(searchResult.companyInfo.symbol, period);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
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
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* 検索セクション */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Search className="h-5 w-5" />
                <span>企業検索</span>
              </CardTitle>
              <CardDescription>
                証券コード、ティッカーシンボル、または企業名で検索してください
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4">
                <div className="flex-1">
                  <Label htmlFor="search" className="sr-only">
                    企業検索
                  </Label>
                  <Input
                    id="search"
                    placeholder="例: 7203, AAPL, トヨタ自動車, ７２０３"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyPress={e => e.key === "Enter" && handleSearch()}
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || isLoading}
                >
                  {isLoading ? "検索中..." : "検索"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* タブコンテンツ */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">概要</TabsTrigger>
              <TabsTrigger value="financial">財務データ</TabsTrigger>
              <TabsTrigger value="chart">株価チャート</TabsTrigger>
              <TabsTrigger value="analysis">AI分析</TabsTrigger>
            </TabsList>

            {/* エラー表示 */}
            {(error || analysisError) && (
              <Card className="mb-6 border-destructive">
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error || analysisError}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 企業概要タブ */}
            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle>企業概要</CardTitle>
                </CardHeader>
                <CardContent>
                  {searchResult ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {searchResult.companyInfo.name}
                          </h3>
                          <p className="text-muted-foreground">
                            {searchResult.companyInfo.symbol}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">
                            {getCurrencySymbol()}
                            {searchResult.stockData.price.toLocaleString()}
                          </p>
                          <p
                            className={`text-sm ${
                              searchResult.stockData.change >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {searchResult.stockData.change >= 0 ? "+" : ""}
                            {getCurrencySymbol()}
                            {searchResult.stockData.change.toFixed(2)} (
                            {searchResult.stockData.changePercent.toFixed(2)}%)
                          </p>
                        </div>
                      </div>
                      {searchResult.companyInfo.description && (
                        <div>
                          <h4 className="font-semibold mb-2">企業説明</h4>
                          <p className="text-muted-foreground">
                            {searchResult.companyInfo.description}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        企業を検索すると、ここに企業情報が表示されます
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 財務データタブ */}
            <TabsContent value="financial">
              <Card>
                <CardHeader>
                  <CardTitle>財務データ</CardTitle>
                  {searchResult?.financialData?.period && (
                    <p className="text-sm text-muted-foreground">
                      {searchResult.financialData.period}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {searchResult ? (
                    <div className="space-y-6">
                      {/* 株価指標 */}
                      <div>
                        <h4 className="font-semibold mb-4">株価指標</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm text-muted-foreground">
                              時価総額
                            </h4>
                            <p className="text-xl font-bold">
                              {searchResult.stockData.marketCap || "N/A"}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm text-muted-foreground">
                              PER
                            </h4>
                            <p className="text-xl font-bold">
                              {searchResult.stockData.pe || "N/A"}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm text-muted-foreground">
                              配当利回り
                            </h4>
                            <p className="text-xl font-bold">
                              {searchResult.stockData.dividend}%
                            </p>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm text-muted-foreground">
                              出来高
                            </h4>
                            <p className="text-xl font-bold">
                              {searchResult.stockData.volume.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 52週レンジ */}
                      <div>
                        <h4 className="font-semibold mb-4">52週レンジ</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm text-muted-foreground">
                              52週高
                            </h4>
                            <p className="text-xl font-bold">
                              {getCurrencySymbol()}
                              {searchResult.stockData.high52.toLocaleString()}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm text-muted-foreground">
                              52週安
                            </h4>
                            <p className="text-xl font-bold">
                              {getCurrencySymbol()}
                              {searchResult.stockData.low52.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 財務諸表 */}
                      {searchResult.financialData && (
                        <div>
                          <h4 className="font-semibold mb-4">
                            財務諸表（最新）
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {searchResult.financialData.revenue && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm text-muted-foreground">
                                  売上高
                                </h4>
                                <p className="text-xl font-bold">
                                  {searchResult.financialData.revenue}
                                </p>
                              </div>
                            )}
                            {searchResult.financialData.netIncome && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm text-muted-foreground">
                                  純利益
                                </h4>
                                <p className="text-xl font-bold">
                                  {searchResult.financialData.netIncome}
                                </p>
                              </div>
                            )}
                            {searchResult.financialData.operatingIncome && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm text-muted-foreground">
                                  営業利益
                                </h4>
                                <p className="text-xl font-bold">
                                  {searchResult.financialData.operatingIncome}
                                </p>
                              </div>
                            )}
                            {searchResult.financialData.totalAssets && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm text-muted-foreground">
                                  総資産
                                </h4>
                                <p className="text-xl font-bold">
                                  {searchResult.financialData.totalAssets}
                                </p>
                              </div>
                            )}
                            {searchResult.financialData.cash && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm text-muted-foreground">
                                  現金・短期投資
                                </h4>
                                <p className="text-xl font-bold">
                                  {searchResult.financialData.cash}
                                </p>
                              </div>
                            )}
                            {searchResult.financialData.eps && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm text-muted-foreground">
                                  EPS
                                </h4>
                                <p className="text-xl font-bold">
                                  {getCurrencySymbol()}
                                  {searchResult.financialData.eps}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        財務情報を取得中...
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 株価チャートタブ */}
            <TabsContent value="chart">
              {searchResult ? (
                <StockChart
                  symbol={searchResult.companyInfo.symbol}
                  data={searchResult.chartData}
                  isLoading={isLoading}
                  currency={getCurrencySymbol()}
                  onPeriodChange={handleChartPeriodChange}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>株価チャート</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        チャートデータを読み込み中...
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* AI分析タブ */}
            <TabsContent value="analysis">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Brain className="h-5 w-5" />
                    <span>AI投資分析</span>
                  </CardTitle>
                  <CardDescription>
                    AIが企業の投資価値を分析し、投資判断をサポートします
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analysisResult ? (
                    <div className="space-y-6">
                      {/* 投資アドバイス */}
                      <div>
                        <h4 className="font-semibold mb-2">投資アドバイス</h4>
                        <p className="text-muted-foreground">
                          {analysisResult.investmentAdvice}
                        </p>
                      </div>

                      {/* 目標株価 */}
                      <div>
                        <h4 className="font-semibold mb-4">目標株価</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-4 border rounded-lg">
                            <h5 className="font-medium text-sm text-muted-foreground">
                              短期
                            </h5>
                            <p className="text-xl font-bold">
                              {getCurrencySymbol()}
                              {analysisResult.targetPrice.shortTerm.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-center p-4 border rounded-lg">
                            <h5 className="font-medium text-sm text-muted-foreground">
                              中期
                            </h5>
                            <p className="text-xl font-bold">
                              {getCurrencySymbol()}
                              {analysisResult.targetPrice.mediumTerm.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-center p-4 border rounded-lg">
                            <h5 className="font-medium text-sm text-muted-foreground">
                              長期
                            </h5>
                            <p className="text-xl font-bold">
                              {getCurrencySymbol()}
                              {analysisResult.targetPrice.longTerm.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 損切りライン */}
                      <div>
                        <h4 className="font-semibold mb-4">損切りライン</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-4 border rounded-lg">
                            <h5 className="font-medium text-sm text-muted-foreground">
                              短期
                            </h5>
                            <p className="text-xl font-bold text-red-600">
                              {getCurrencySymbol()}
                              {analysisResult.stopLoss.shortTerm.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-center p-4 border rounded-lg">
                            <h5 className="font-medium text-sm text-muted-foreground">
                              中期
                            </h5>
                            <p className="text-xl font-bold text-red-600">
                              {getCurrencySymbol()}
                              {analysisResult.stopLoss.mediumTerm.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-center p-4 border rounded-lg">
                            <h5 className="font-medium text-sm text-muted-foreground">
                              長期
                            </h5>
                            <p className="text-xl font-bold text-red-600">
                              {getCurrencySymbol()}
                              {analysisResult.stopLoss.longTerm.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* リスクレベル */}
                      <div>
                        <h4 className="font-semibold mb-2">リスクレベル</h4>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              analysisResult.riskLevel === "low"
                                ? "bg-green-100 text-green-800"
                                : analysisResult.riskLevel === "medium"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {analysisResult.riskLevel === "low"
                              ? "低リスク"
                              : analysisResult.riskLevel === "medium"
                              ? "中リスク"
                              : "高リスク"}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            信頼度: {analysisResult.confidence}%
                          </span>
                        </div>
                      </div>

                      {/* 重要な要因 */}
                      {analysisResult.keyFactors.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">重要な要因</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {analysisResult.keyFactors.map((factor, index) => (
                              <li key={index} className="text-muted-foreground">
                                {factor}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 推奨事項 */}
                      {analysisResult.recommendations.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">推奨事項</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {analysisResult.recommendations.map(
                              (recommendation, index) => (
                                <li
                                  key={index}
                                  className="text-muted-foreground"
                                >
                                  {recommendation}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">
                        {searchResult
                          ? "AI分析を開始してください"
                          : "企業を選択してから分析を開始してください"}
                      </p>
                      <Button
                        onClick={handleAnalyze}
                        disabled={!searchResult || isAnalyzing}
                        className="w-full max-w-xs"
                      >
                        {isAnalyzing ? (
                          <>
                            <Brain className="h-4 w-4 mr-2 animate-spin" />
                            分析中...
                          </>
                        ) : (
                          <>
                            <Brain className="h-4 w-4 mr-2" />
                            この企業を分析する
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
