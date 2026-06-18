"use client";

import { useState, useCallback, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useCompanySearch } from "@/hooks/useCompanySearch";
import { useAIAnalysis } from "@/hooks/useAIAnalysis";
import { useAuth } from "@/hooks/useAuth";
import { StockChart } from "@/components/StockChart";
import { AuthModal } from "@/components/AuthModal";
import { StockSidePanel } from "@/components/StockSidePanel";
import { useNewsAnalysis } from "@/hooks/useNewsAnalysis";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import { useTopTradingValue } from "@/hooks/useTopTradingValue";
import { useFinancialEvaluation } from "@/hooks/useFinancialEvaluation";
import { useDailyUsage } from "@/hooks/useDailyUsage";
import { SearchSection } from "@/components/SearchSection";
import { TopTradingValueSection } from "@/components/TopTradingValueSection";
import { AskSection } from "@/components/AskSection";
import { FinancialEvaluationSection } from "@/components/FinancialEvaluationSection";
import { NewsSection } from "@/components/NewsSection";
import { SubscriptionStatus } from "@/components/SubscriptionStatus";
import { SponsoredAds } from "@/components/SponsoredAds";
import { SignalsNav } from "@/components/signals/SignalsNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LivePulseStrip } from "@/components/LivePulseStrip";
import { MarketFrontPage } from "@/components/frontpage/MarketFrontPage";
import type { TradingValueItem } from "@/hooks/useTopTradingValue";
import { isNative } from "@/lib/utils/platformDetect";
import { shouldShowSponsoredAds } from "@/lib/utils/sponsoredAds";
import { APP_NAME } from "@/lib/constants";

function PurchaseSuccessHandler() {
  const searchParams = useSearchParams();
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get("purchase") === "success") {
      setPurchaseSuccess(true);
      // URLからパラメータを削除
      window.history.replaceState({}, "", "/");
      // 5秒後にメッセージを非表示
      const timer = setTimeout(() => setPurchaseSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  if (!purchaseSuccess) return null;

  return (
    <div className="mb-6 rounded-md border border-green-500 bg-green-100 p-4 text-green-800">
      <p className="font-semibold">🎉 ご購入ありがとうございます！</p>
      <p className="text-sm mt-1">
        プレミアム機能がまもなく有効化されます。反映まで数秒お待ちください。
      </p>
    </div>
  );
}

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [chartPeriod, setChartPeriod] = useState("1M");
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(true);
  const { isLoading, error, searchResult, searchCompany } = useCompanySearch();
  const {
    isAnalyzing,
    error: analysisError,
    analysisResult,
    streamingText,
    analyzeStock,
    clearAnalysis: clearAiAnalysis,
    retry: retryAnalysis,
  } = useAIAnalysis();
  const { user, logout } = useAuth();
  const {
    isLoading: isNewsAnalyzing,
    error: newsError,
    newsData: analyzedNews,
    analysis: newsAnalysis,
    analyzeNews,
    clearAnalysis: clearNewsAnalysis,
    retry: retryNewsAnalysis,
  } = useNewsAnalysis();
  const {
    suggestions,
    isLoading: isSuggestLoading,
    searchSuggestions,
    clearSuggestions,
  } = useSearchSuggestions();
  const {
    items: tradingRanking,
    isLoading: isRankingLoading,
    error: rankingError,
    warning: rankingWarning,
  } = useTopTradingValue();
  const {
    isLoading: isFinancialLoading,
    error: financialError,
    result: financialEval,
    evaluate: evaluateFinancials,
    retry: retryFinancialEval,
  } = useFinancialEvaluation();
  const {
    canUseFeature,
    remainingUses,
    isPremium,
    incrementUsage,
    dailyLimit,
  } = useDailyUsage();
  const showSponsoredAds = shouldShowSponsoredAds({
    isPremium,
    isNativeApp,
  });

  useEffect(() => {
    setIsNativeApp(isNative());
  }, []);

  const handleSearchAndAnalyze = useCallback(async () => {
    const queryToUse = searchQuery.trim();
    if (!queryToUse) return;

    setShowSuggestions(false);
    setActiveSuggestion(-1);
    clearSuggestions();
    clearAiAnalysis();
    clearNewsAnalysis();

    await searchCompany(queryToUse, chartPeriod);
  }, [
    searchQuery,
    chartPeriod,
    searchCompany,
    clearSuggestions,
    clearAiAnalysis,
    clearNewsAnalysis,
  ]);

  const handleInputChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (value.trim().length < 1) {
        clearSuggestions();
        setShowSuggestions(false);
        setActiveSuggestion(-1);
        return;
      }
      setShowSuggestions(true);
      setActiveSuggestion(-1);
      searchSuggestions(value);
    },
    [searchSuggestions, clearSuggestions]
  );

  const handleSelectSuggestion = useCallback(
    async (symbol: string, displayText?: string) => {
      setSearchQuery(displayText || symbol);
      setShowSuggestions(false);
      clearSuggestions();
      clearAiAnalysis();
      clearNewsAnalysis();
      await searchCompany(symbol, chartPeriod);
    },
    [
      chartPeriod,
      searchCompany,
      clearSuggestions,
      clearAiAnalysis,
      clearNewsAnalysis,
    ]
  );

  const renderHighlighted = useCallback((text: string, query: string) => {
    if (!query) return text;
    try {
      const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safeQuery, "ig");
      const matches = text.match(regex) || [];
      const parts = text.split(regex);

      return (
        <>
          {parts.map((part, index) => (
            <span key={`part-${index}`}>
              {part}
              {matches[index] && (
                <mark
                  key={`mark-${index}`}
                  className="bg-yellow-100 text-foreground px-0.5 rounded"
                >
                  {matches[index]}
                </mark>
              )}
            </span>
          ))}
        </>
      );
    } catch {
      return text;
    }
  }, []);

  const handleAsk = useCallback(
    async (question: string) => {
      if (!searchResult) return;
      if (!canUseFeature) return;
      incrementUsage();
      const edinetExtras =
        searchResult.ratios != null || searchResult.financialHistory != null
          ? {
              ratios: searchResult.ratios ?? undefined,
              financialHistory: searchResult.financialHistory ?? undefined,
              accountingStandard: searchResult.accountingStandard ?? undefined,
            }
          : undefined;
      await analyzeStock(
        searchResult.companyInfo,
        searchResult.stockData,
        searchResult.newsData,
        edinetExtras,
        question
      );
    },
    [searchResult, analyzeStock, canUseFeature, incrementUsage]
  );

  const getCurrencySymbol = useMemo(() => {
    if (!searchResult) return "$";
    return searchResult.companyInfo.market === "TYO" ? "¥" : "$";
  }, [searchResult]);

  const handleChartPeriodChange = useCallback(
    async (period: string) => {
      setChartPeriod(period);
      if (searchResult) {
        await searchCompany(searchResult.companyInfo.symbol, period);
      }
    },
    [searchResult, searchCompany]
  );

  const handleNewsAnalysis = useCallback(async () => {
    if (!searchResult) return;
    if (!canUseFeature) return;
    incrementUsage();
    await analyzeNews(
      searchResult.companyInfo.symbol,
      searchResult.companyInfo.name
    );
  }, [searchResult, analyzeNews, canUseFeature, incrementUsage]);

  const handleFinancialEvaluation = useCallback(async () => {
    if (!searchResult) return;
    if (!canUseFeature) return;
    incrementUsage();
    await evaluateFinancials({
      symbol: searchResult.companyInfo.symbol,
      companyName: searchResult.companyInfo.name,
      financialData: searchResult.financialData,
    });
  }, [searchResult, evaluateFinancials, canUseFeature, incrementUsage]);

  const getScoreLabel = useCallback((score: number) => {
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
  }, []);

  const getScoreColor = useCallback((score: number) => {
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
  }, []);

  const handlePickSelect = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      setShowSuggestions(false);
      setActiveSuggestion(-1);
      clearSuggestions();
      clearAiAnalysis();
      clearNewsAnalysis();
      await searchCompany(query, chartPeriod);
    },
    [
      chartPeriod,
      searchCompany,
      clearSuggestions,
      clearAiAnalysis,
      clearNewsAnalysis,
    ]
  );

  const handleFrontPageIdeaSelect = useCallback(
    (item: TradingValueItem) => {
      const symbol =
        item.code && /^\d{4}$/.test(item.code) ? `${item.code}:TYO` : item.code;
      handlePickSelect(symbol || item.name);
    },
    [handlePickSelect]
  );

  const searchSection = (
    <SearchSection
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      showSuggestions={showSuggestions}
      setShowSuggestions={setShowSuggestions}
      activeSuggestion={activeSuggestion}
      setActiveSuggestion={setActiveSuggestion}
      suggestions={suggestions}
      isSuggestLoading={isSuggestLoading}
      isLoading={isLoading}
      onSearch={handleSearchAndAnalyze}
      onInputChange={handleInputChange}
      onSelectSuggestion={handleSelectSuggestion}
      renderHighlighted={renderHighlighted}
    />
  );

  const sampleStockSlot = !isLoading ? (
    <Card className="border-dashed">
      <CardContent className="py-4">
        <div className="space-y-3">
          <div className="text-sm font-medium">サンプル銘柄</div>
          <div className="flex flex-wrap gap-2">
            {[
              {
                symbol: "7203",
                name: "トヨタ自動車",
                display: "7203 トヨタ",
                dotColor: "bg-emerald-500",
              },
              {
                symbol: "AAPL",
                name: "Apple",
                display: "AAPL Apple",
                dotColor: "bg-sky-500",
              },
              {
                symbol: "9984",
                name: "ソフトバンクグループ",
                display: "9984 SBG",
                dotColor: "bg-purple-500",
              },
              {
                symbol: "5020",
                name: "ENEOSホールディングス",
                display: "5020 ENEOS",
                dotColor: "bg-amber-500",
              },
            ].map(stock => (
              <Button
                key={stock.symbol}
                variant="outline"
                size="sm"
                onClick={() => handleSelectSuggestion(stock.symbol, stock.name)}
                className="font-medium gap-2 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/50"
              >
                <span
                  className={`size-2 rounded-full ${stock.dotColor}`}
                  aria-hidden="true"
                />
                {stock.display}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  ) : null;

  const stockIdeasSection = (
    <TopTradingValueSection
      items={tradingRanking}
      isLoading={isRankingLoading}
      error={rankingError}
      warning={rankingWarning}
      onSelect={handlePickSelect}
    />
  );

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <TrendingUp className="h-8 w-8 text-primary drop-shadow-[0_0_18px_hsl(var(--primary)/0.45)]" />
              </div>
	              <div className="leading-tight">
	                <h1 className="text-2xl font-bold tracking-tight">
	                  <span className="brand-gradient">{APP_NAME}</span>
	                </h1>
                <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">
                  AIで株式分析と市場シグナルを 30 秒で
                </p>
              </div>
            </div>
            <SignalsNav active="home" />
            <div className="flex items-center space-x-2 sm:space-x-4">
              <ThemeToggle />
              {user ? (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground hidden sm:inline">
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
      <main className="container mx-auto px-4 py-6 relative z-10">
        {/* 購入成功メッセージ */}
        <Suspense fallback={null}>
          <PurchaseSuccessHandler />
        </Suspense>

        {/* 購入状態表示（ログイン時のみ） */}
        {user && (
          <div className="mb-6">
            <SubscriptionStatus />
          </div>
        )}

        {!searchResult ? (
          <MarketFrontPage
            searchSlot={searchSection}
            pulseSlot={<LivePulseStrip />}
            stockIdeasSlot={stockIdeasSection}
            sampleSlot={sampleStockSlot}
            topIdea={tradingRanking[0]}
            isStockIdeasLoading={isRankingLoading}
            warning={rankingWarning}
            remainingUses={remainingUses}
            dailyLimit={dailyLimit}
            isPremium={isPremium}
            onSelectIdea={handleFrontPageIdeaSelect}
          />
        ) : (
          <>
            {/* 無料プラン案内 */}
            <div className="mb-6 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
              <div className="flex items-center justify-between">
                <span>
                  無料プランではAI機能を1日{dailyLimit}
                  回までご利用いただけます。
                </span>
                {!isPremium && (
                  <span
                    className={`ml-3 flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold ${
                      canUseFeature
                        ? "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200"
                    }`}
                  >
                    残り{remainingUses}/{dailyLimit}回
                  </span>
                )}
              </div>
            </div>
            <LivePulseStrip />
            {searchSection}
          </>
        )}

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
                  <div className="flex gap-2 mt-3">
                    {analysisError && (
                      <button
                        onClick={retryAnalysis}
                        className="text-xs px-3 py-1.5 bg-destructive/10 hover:bg-destructive/20 rounded-md transition-colors"
                      >
                        AI分析を再試行
                      </button>
                    )}
                    {newsError && (
                      <button
                        onClick={retryNewsAnalysis}
                        className="text-xs px-3 py-1.5 bg-destructive/10 hover:bg-destructive/20 rounded-md transition-colors"
                      >
                        ニュース分析を再試行
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {searchResult && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* チャート部分（左側 - 3カラム） */}
            <div className="lg:col-span-3">
              <div className="space-y-6">
                {/* チャートセクション */}
                <StockChart
                  symbol={searchResult.companyInfo.symbol}
                  data={searchResult.chartData}
                  isLoading={isLoading}
                  currency={getCurrencySymbol}
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

                {/* AIに質問するセクション（会話型UI） */}
                <AskSection
                  onAsk={handleAsk}
                  isAnalyzing={isAnalyzing}
                  streamingText={streamingText}
                  analysisResult={analysisResult}
                  canUseFeature={canUseFeature}
                  remainingUses={remainingUses}
                  dailyLimit={dailyLimit}
                  isPremium={isPremium}
                  currencySymbol={getCurrencySymbol}
                />

                {/* 財務健全性（BS/PL/CF）評価 */}
                <FinancialEvaluationSection
                  financialEval={financialEval}
                  isFinancialLoading={isFinancialLoading}
                  onEvaluate={handleFinancialEvaluation}
                  getScoreLabel={getScoreLabel}
                  getScoreColor={getScoreColor}
                  canUseFeature={canUseFeature}
                  remainingUses={remainingUses}
                  dailyLimit={dailyLimit}
                  isPremium={isPremium}
                />

                {/* ニュースセクション */}
                <NewsSection
                  newsAnalysis={newsAnalysis}
                  analyzedNews={analyzedNews}
                  newsData={searchResult.newsData}
                  isNewsAnalyzing={isNewsAnalyzing}
                  onAnalyze={handleNewsAnalysis}
                  canUseFeature={canUseFeature}
                  remainingUses={remainingUses}
                  dailyLimit={dailyLimit}
                  isPremium={isPremium}
                />
              </div>
            </div>

            {/* サイドパネル（右側 - 1カラム） */}
            <div className="lg:col-span-1">
              <StockSidePanel
                companyInfo={searchResult.companyInfo}
                stockData={searchResult.stockData}
                financialData={searchResult.financialData}
                currency={getCurrencySymbol}
              />
            </div>
          </div>
        )}

	        {/* フッター広告セクション（フリーユーザーのみ表示） */}
	        {showSponsoredAds && <SponsoredAds />}
      </main>

      {/* フッター */}
      <footer className="border-t border-border bg-card mt-8">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col items-center space-y-3">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <Link
                href="/terms-of-use"
                className="hover:text-foreground hover:underline"
              >
                利用規約
              </Link>
              <span>·</span>
              <Link
                href="/privacy-policy"
                className="hover:text-foreground hover:underline"
              >
                プライバシーポリシー
              </Link>
	            </div>
	            <p className="text-[10px] text-muted-foreground">
	              © 2026 {APP_NAME}. All rights reserved.
	            </p>
          </div>
        </div>
      </footer>

      {/* 認証モーダル */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}
