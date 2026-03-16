"use client";

import { useState, useCallback, useMemo, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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
import { useTextBlocks } from "@/hooks/useTextBlocks";
import { SearchSection } from "@/components/SearchSection";
import { TopTradingValueSection } from "@/components/TopTradingValueSection";
import { RankingSection } from "@/components/RankingSection";
import { AnalysisSection } from "@/components/AnalysisSection";
import { FinancialEvaluationSection } from "@/components/FinancialEvaluationSection";
import { FinancialTrendChart } from "@/components/FinancialTrendChart";
import { TextBlocksSection } from "@/components/TextBlocksSection";
import { NewsSection } from "@/components/NewsSection";
import { SubscriptionStatus } from "@/components/SubscriptionStatus";
import { CastleSection } from "@/components/castle/CastleSection";

function PurchaseSuccessHandler() {
  const searchParams = useSearchParams();
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get("purchase") === "success") {
      setPurchaseSuccess(true);
      window.history.replaceState({}, "", "/");
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

  const { isLoading, error, searchResult, searchCompany } = useCompanySearch();
  const {
    isAnalyzing,
    error: analysisError,
    analysisResult,
    analyzeStock,
    clearAnalysis: clearAiAnalysis,
  } = useAIAnalysis();
  const { user, logout } = useAuth();
  const {
    isLoading: isNewsAnalyzing,
    error: newsError,
    newsData: analyzedNews,
    analysis: newsAnalysis,
    analyzeNews,
    clearAnalysis: clearNewsAnalysis,
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
  } = useTopTradingValue();
  const {
    isLoading: isFinancialLoading,
    error: financialError,
    result: financialEval,
    evaluate: evaluateFinancials,
  } = useFinancialEvaluation();
  const {
    textBlocks,
    aiSummary,
    isLoading: isTextLoading,
    isSummarizing,
    error: textError,
    fetchTextBlocks,
    summarizeWithAI,
    clear: clearTextBlocks,
  } = useTextBlocks();

  const handleSearchAndAnalyze = useCallback(async () => {
    const queryToUse = searchQuery.trim();
    if (!queryToUse) return;

    setShowSuggestions(false);
    setActiveSuggestion(-1);
    clearSuggestions();
    clearAiAnalysis();
    clearNewsAnalysis();
    clearTextBlocks();

    await searchCompany(queryToUse, chartPeriod);
  }, [searchQuery, chartPeriod, searchCompany, clearSuggestions, clearAiAnalysis, clearNewsAnalysis, clearTextBlocks]);

  const handleInputChange = useCallback((value: string) => {
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
  }, [searchSuggestions, clearSuggestions]);

  const handleSelectSuggestion = useCallback(async (
    symbol: string,
    displayText?: string
  ) => {
    setSearchQuery(displayText || symbol);
    setShowSuggestions(false);
    clearSuggestions();
    clearAiAnalysis();
    clearNewsAnalysis();
    clearTextBlocks();
    await searchCompany(symbol, chartPeriod);
  }, [chartPeriod, searchCompany, clearSuggestions, clearAiAnalysis, clearNewsAnalysis, clearTextBlocks]);

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

  const handleAnalyze = useCallback(async () => {
    if (!searchResult) return;
    await analyzeStock(
      searchResult.companyInfo,
      searchResult.stockData,
      searchResult.newsData,
      // EDINET DB データを追加
      searchResult.ratios || searchResult.financialHistory
        ? {
            ratios: searchResult.ratios,
            financialHistory: searchResult.financialHistory ?? undefined,
            accountingStandard: searchResult.accountingStandard,
          }
        : undefined
    );
  }, [searchResult, analyzeStock]);

  const getCurrencySymbol = useMemo(() => {
    if (!searchResult) return "$";
    return searchResult.companyInfo.market === "TYO" ? "¥" : "$";
  }, [searchResult]);

  const handleChartPeriodChange = useCallback(async (period: string) => {
    setChartPeriod(period);
    if (searchResult) {
      await searchCompany(searchResult.companyInfo.symbol, period);
    }
  }, [searchResult, searchCompany]);

  const handleNewsAnalysis = useCallback(async () => {
    if (!searchResult) return;
    await analyzeNews(
      searchResult.companyInfo.symbol,
      searchResult.companyInfo.name
    );
  }, [searchResult, analyzeNews]);

  const handleFinancialEvaluation = useCallback(async () => {
    if (!searchResult) return;
    await evaluateFinancials({
      symbol: searchResult.companyInfo.symbol,
      companyName: searchResult.companyInfo.name,
      financialData: searchResult.financialData,
      edinetCode: searchResult.edinetCode,
      ratios: searchResult.ratios,
      financialHistory: searchResult.financialHistory ?? undefined,
      accountingStandard: searchResult.accountingStandard,
    });
  }, [searchResult, evaluateFinancials]);

  const handleFetchTextBlocks = useCallback(() => {
    if (!searchResult?.edinetCode) return;
    fetchTextBlocks(searchResult.edinetCode);
  }, [searchResult, fetchTextBlocks]);

  const handleSummarizeTextBlocks = useCallback(() => {
    if (!searchResult?.edinetCode) return;
    summarizeWithAI(searchResult.edinetCode, searchResult.companyInfo.name);
  }, [searchResult, summarizeWithAI]);

  const getScoreLabel = useCallback((score: number) => {
    switch (score) {
      case 5: return "非常に優秀";
      case 4: return "優秀";
      case 3: return "標準";
      case 2: return "やや劣る";
      case 1: return "劣る";
      default: return "標準";
    }
  }, []);

  const getScoreColor = useCallback((score: number) => {
    switch (score) {
      case 5: return "text-green-700 bg-green-100";
      case 4: return "text-blue-700 bg-blue-100";
      case 3: return "text-gray-700 bg-gray-100";
      case 2: return "text-orange-700 bg-orange-100";
      case 1: return "text-red-700 bg-red-100";
      default: return "text-gray-700 bg-gray-100";
    }
  }, []);

  const handlePickSelect = useCallback(async (query: string) => {
    if (!query || !query.trim()) return;
    const trimmedQuery = query.trim();
    try {
      setSearchQuery(trimmedQuery);
      setShowSuggestions(false);
      setActiveSuggestion(-1);
      clearSuggestions();
      clearAiAnalysis();
      clearNewsAnalysis();
      clearTextBlocks();
      await searchCompany(trimmedQuery, chartPeriod);
    } catch (error) {
      console.error("注目銘柄の分析開始時にエラーが発生しました:", error);
    }
  }, [chartPeriod, searchCompany, clearSuggestions, clearAiAnalysis, clearNewsAnalysis, clearTextBlocks]);

  // 日本企業かどうかの判定（EDINET Code があれば日本企業）
  const isJapaneseCompany = Boolean(searchResult?.edinetCode);

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
        {/* 購入成功メッセージ */}
        <Suspense fallback={null}>
          <PurchaseSuccessHandler />
        </Suspense>

        {/* 無料プラン案内 */}
        <div className="mb-6 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          無料プランはログイン不要でご利用いただけます。登録なしですぐにお試しください。
        </div>

        {/* 購入状態表示（ログイン時のみ） */}
        {user && (
          <div className="mb-6">
            <SubscriptionStatus />
          </div>
        )}

        {/* 検索セクション */}
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

        {/* 本日の売買代金ランキング */}
        <TopTradingValueSection
          items={tradingRanking}
          isLoading={isRankingLoading}
          error={rankingError}
          onSelect={handlePickSelect}
        />

        {/* 財務指標ランキング（EDINET DB） */}
        <RankingSection onSelect={handlePickSelect} />

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

                {/* 財務推移チャート（EDINET DB データがある場合のみ） */}
                {searchResult.financialHistory && searchResult.financialHistory.length > 0 && (
                  <FinancialTrendChart
                    financialHistory={searchResult.financialHistory as import("@/hooks/useCompanySearch").FinancialHistoryItem[]}
                    companyName={searchResult.companyInfo.name}
                  />
                )}

                {/* AI分析セクション */}
                <AnalysisSection
                  analysisResult={analysisResult}
                  isAnalyzing={isAnalyzing}
                  onAnalyze={handleAnalyze}
                  currencySymbol={getCurrencySymbol}
                />

                {/* 財務健全性（BS/PL/CF）評価 */}
                <FinancialEvaluationSection
                  financialEval={financialEval}
                  isFinancialLoading={isFinancialLoading}
                  onEvaluate={handleFinancialEvaluation}
                  getScoreLabel={getScoreLabel}
                  getScoreColor={getScoreColor}
                />

                {/* 有報テキスト分析（日本企業のみ） */}
                {isJapaneseCompany && (
                  <TextBlocksSection
                    edinetCode={searchResult.edinetCode!}
                    companyName={searchResult.companyInfo.name}
                    textBlocks={textBlocks}
                    aiSummary={aiSummary}
                    isLoading={isTextLoading}
                    isSummarizing={isSummarizing}
                    error={textError}
                    onFetchTextBlocks={handleFetchTextBlocks}
                    onSummarize={handleSummarizeTextBlocks}
                  />
                )}

                {/* 企業城郭図鑑 */}
                <CastleSection
                  symbol={searchResult.companyInfo.symbol}
                  companyName={searchResult.companyInfo.name}
                  edinetCode={searchResult.edinetCode}
                />

                {/* ニュースセクション */}
                <NewsSection
                  newsAnalysis={newsAnalysis}
                  analyzedNews={analyzedNews}
                  newsData={searchResult.newsData}
                  isNewsAnalyzing={isNewsAnalyzing}
                  onAnalyze={handleNewsAnalysis}
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
                accountingStandard={searchResult.accountingStandard}
                ratios={searchResult.ratios}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 広告1 */}
              <div>
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

              {/* 広告2 */}
              <div>
                <a
                  href="https://px.a8.net/svt/ejp?a8mat=45GF9C+BAN2YA+3KHK+BXYE9"
                  rel="nofollow"
                >
                  <Image
                    width={300}
                    height={250}
                    alt=""
                    src="https://www25.a8.net/svt/bgt?aid=251029056683&wid=001&eno=01&mid=s00000016652002006000&mc=1"
                    style={{ border: "0" }}
                  />
                </a>
                <Image
                  width={1}
                  height={1}
                  src="https://www10.a8.net/0.gif?a8mat=45GF9C+BAN2YA+3KHK+BXYE9"
                  alt=""
                  style={{ border: "0" }}
                />
              </div>
            </div>
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
