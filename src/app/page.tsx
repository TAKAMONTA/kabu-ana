"use client";

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  Suspense,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Crown,
} from "lucide-react";
import {
  NOT_FOUND_MESSAGE,
  useCompanySearch,
  type SearchResult,
} from "@/hooks/useCompanySearch";
import { useAIAnalysis } from "@/hooks/useAIAnalysis";
import { useAuth } from "@/hooks/useAuth";
import { StockChart } from "@/components/StockChart";
import { AuthModal } from "@/components/AuthModal";
import {
  StockPriceHeaderCard,
  StockSidePanel,
} from "@/components/StockSidePanel";
import { DigestSection } from "@/components/DigestSection";
import { WatchlistSection } from "@/components/WatchlistSection";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useNewsAnalysis } from "@/hooks/useNewsAnalysis";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import { useTopTradingValue } from "@/hooks/useTopTradingValue";
import { useFinancialEvaluation } from "@/hooks/useFinancialEvaluation";
import { useDailyUsage } from "@/hooks/useDailyUsage";
import { SearchSection } from "@/components/SearchSection";
import { TopTradingValueSection } from "@/components/TopTradingValueSection";
import { AskSection } from "@/components/AskSection";
import { FinancialEvaluationSection } from "@/components/FinancialEvaluationSection";
import { FreePerformanceSummary } from "@/components/FreePerformanceSummary";
import { NewsSection } from "@/components/NewsSection";
import { SubscriptionStatus } from "@/components/SubscriptionStatus";
import { SponsoredAds } from "@/components/SponsoredAds";
import { SignalsNav } from "@/components/signals/SignalsNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LivePulseStrip } from "@/components/LivePulseStrip";
import { MarketFrontPage } from "@/components/frontpage/MarketFrontPage";
import { markFirstVisitGuideSeen } from "@/components/frontpage/FirstVisitGuide";
import { DataStatusCard } from "@/components/DataStatusCard";
import { buildAiReferenceLabels, buildDataStatus } from "@/lib/dataStatus";
import { FREE_WATCHLIST_LIMIT } from "@/lib/watchlist/limits";
import type { TradingValueItem } from "@/hooks/useTopTradingValue";
import { isNative } from "@/lib/utils/platformDetect";
import { shouldShowSponsoredAds } from "@/lib/utils/sponsoredAds";
import { APP_NAME } from "@/lib/constants";
import { getCompanyProfileView } from "@/lib/companyProfile";

const SAMPLE_STOCKS = [
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
];

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
  const {
    isLoading,
    error,
    searchResult,
    searchCompany,
    retry: retrySearch,
    clearSearch,
  } = useCompanySearch();
  const {
    isAnalyzing,
    status: analysisStatus,
    error: analysisError,
    analysisResult,
    analyzedAt,
    streamingText,
    bundleTokens,
    analyzeStock,
    clearAnalysis: clearAiAnalysis,
    retry: retryAnalysis,
  } = useAIAnalysis();
  const { user, logout } = useAuth();
  const watchlist = useWatchlist();
  const {
    isLoading: isNewsAnalyzing,
    error: newsError,
    newsData: analyzedNews,
    analysis: newsAnalysis,
    empty: newsEmpty,
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
    refresh: refreshRanking,
  } = useTopTradingValue();
  const {
    isLoading: isFinancialLoading,
    error: financialError,
    result: financialEval,
    evaluate: evaluateFinancials,
    clear: clearFinancialEval,
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
  const autoAnalyzedSymbolRef = useRef<string | null>(null);
  const autoExtraAnalyzedSymbolRef = useRef<string | null>(null);
  // 新しい検索を始めた時点で表示していた結果。新しい結果が届くまでは、
  // この結果を対象に自動分析を走らせない（前の銘柄の分析が終わった拍子に
  // 前の銘柄を分析し直して無料回数を消費する、を防ぐ）
  const staleSearchResultRef = useRef<SearchResult | null>(null);

  useEffect(() => {
    setIsNativeApp(isNative());
  }, []);

  useEffect(() => {
    if (searchResult) markFirstVisitGuideSeen();
  }, [searchResult]);

  const dataStatusItems = useMemo(
    () => (searchResult ? buildDataStatus(searchResult) : []),
    [searchResult]
  );
  // 再取得やチャート期間変更で検索結果が差し替わっても、表示するのは
  // 「分析を実行した時点で AI に渡したデータ」にする
  const [aiReferenceLabels, setAiReferenceLabels] = useState<string[]>([]);

  /** 表示中の銘柄に紐づく分析（メイン・財務・ニュース）をすべて破棄する */
  const resetAnalysisState = useCallback(() => {
    clearAiAnalysis();
    clearNewsAnalysis();
    clearFinancialEval();
    autoAnalyzedSymbolRef.current = null;
    autoExtraAnalyzedSymbolRef.current = null;
    setIsDescriptionExpanded(false);
  }, [clearAiAnalysis, clearNewsAnalysis, clearFinancialEval]);

  /** 別の銘柄を探す検索を始める（入力・候補・サンプル・話題の銘柄から共通） */
  const startNewSearch = useCallback(
    async (query: string) => {
      setShowSuggestions(false);
      setActiveSuggestion(-1);
      clearSuggestions();
      resetAnalysisState();
      staleSearchResultRef.current = searchResult;
      // 失敗したら前の銘柄の画面も消し、検索欄の下にエラーだけを出す
      await searchCompany(query, chartPeriod, { clearOnError: true });
    },
    [
      chartPeriod,
      searchCompany,
      searchResult,
      clearSuggestions,
      resetAnalysisState,
    ]
  );

  const handleSearchAndAnalyze = useCallback(async () => {
    const queryToUse = searchQuery.trim();
    if (!queryToUse) return;
    await startNewSearch(queryToUse);
  }, [searchQuery, startNewSearch]);

  /**
   * ロゴ・「銘柄分析」から一面（検索前の画面）に戻る。
   * 同じ "/" へのリンクでは画面が切り替わらず、初回検索後は一面に戻る手段が無かった
   */
  const resetToFrontPage = useCallback(() => {
    resetAnalysisState();
    clearSearch();
    staleSearchResultRef.current = null;
    setSearchQuery("");
    setShowSuggestions(false);
    setActiveSuggestion(-1);
    clearSuggestions();
    window.scrollTo({ top: 0 });
  }, [resetAnalysisState, clearSearch, clearSuggestions]);

  const handleHomeLinkClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      // 新しいタブで開く操作（Ctrl/⌘+クリック等）はブラウザに任せる
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.button !== 0
      )
        return;
      event.preventDefault();
      resetToFrontPage();
    },
    [resetToFrontPage]
  );

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
      await startNewSearch(symbol);
    },
    [startNewSearch]
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

  const runAiAnalysis = useCallback(
    async (question: string) => {
      if (!searchResult) return;
      if (!canUseFeature) return;
      setAiReferenceLabels(buildAiReferenceLabels(searchResult));
      const edinetExtras =
        searchResult.ratios != null || searchResult.financialHistory != null
          ? {
              ratios: searchResult.ratios ?? undefined,
              financialHistory: searchResult.financialHistory ?? undefined,
              accountingStandard: searchResult.accountingStandard ?? undefined,
            }
          : undefined;
      const succeeded = await analyzeStock(
        searchResult.companyInfo,
        searchResult.stockData,
        searchResult.newsData,
        edinetExtras,
        question
      );
      // 無料回数は分析が成功してから数える（失敗・中断した分は減らさない）
      if (succeeded) incrementUsage();
    },
    [searchResult, analyzeStock, canUseFeature, incrementUsage]
  );

  const handleRetryAnalysis = useCallback(async () => {
    const succeeded = await retryAnalysis();
    if (succeeded) incrementUsage();
  }, [retryAnalysis, incrementUsage]);

  useEffect(() => {
    if (!searchResult) return;
    if (searchResult === staleSearchResultRef.current) return;
    if (isAnalyzing) return;
    if (!canUseFeature) return;

    const symbol = searchResult.companyInfo.symbol;
    if (autoAnalyzedSymbolRef.current === symbol) return;

    autoAnalyzedSymbolRef.current = symbol;
    void runAiAnalysis(
      "会社紹介は不要です。注目すべき数値ファクトを2〜3個に絞り、それぞれが初心者にとって何を意味するかを説明したうえで、「だから私はこう見ます」という形で見立てを書いてください。最後に次に見るべき確認点を1つ示してください。"
    );
  }, [searchResult, isAnalyzing, canUseFeature, runAiAnalysis]);

  useEffect(() => {
    if (!searchResult) return;
    if (searchResult === staleSearchResultRef.current) return;
    if (isAnalyzing) return;
    if (!analysisResult) return;
    if (!bundleTokens?.financial || !bundleTokens?.news) return;

    const symbol = searchResult.companyInfo.symbol;
    if (autoExtraAnalyzedSymbolRef.current === symbol) return;
    autoExtraAnalyzedSymbolRef.current = symbol;

    const edinetExtras =
      searchResult.ratios != null || searchResult.financialHistory != null
        ? {
            ratios: searchResult.ratios ?? undefined,
            financialHistory: searchResult.financialHistory ?? undefined,
            accountingStandard: searchResult.accountingStandard ?? undefined,
          }
        : undefined;

    void evaluateFinancials(
      {
        symbol: searchResult.companyInfo.symbol,
        companyName: searchResult.companyInfo.name,
        financialData: searchResult.financialData,
        edinetExtras,
      },
      { bundleToken: bundleTokens.financial }
    );
    void analyzeNews(
      searchResult.companyInfo.symbol,
      searchResult.companyInfo.name,
      { bundleToken: bundleTokens.news }
    );
  }, [
    searchResult,
    isAnalyzing,
    analysisResult,
    bundleTokens,
    evaluateFinancials,
    analyzeNews,
  ]);

  // 日本株は market が "TYO" のほか、J-Quants 経由だと「プライム」等の市場区分に
  // なることがあるため、証券コード（7203 / 130A 形式）でも判定する
  const isJapanStock = useMemo(() => {
    if (!searchResult) return false;
    const { market, symbol } = searchResult.companyInfo;
    return market === "TYO" || /^\d{3}[0-9A-Z]$/.test(symbol);
  }, [searchResult]);

  const getCurrencySymbol = isJapanStock ? "¥" : "$";

  const companyProfile = useMemo(
    () => getCompanyProfileView(searchResult?.companyInfo.description),
    [searchResult]
  );

  const handleChartPeriodChange = useCallback(
    async (period: string) => {
      setChartPeriod(period);
      if (searchResult) {
        await searchCompany(searchResult.companyInfo.symbol, period);
      }
    },
    [searchResult, searchCompany]
  );

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
      await startNewSearch(query);
    },
    [startNewSearch]
  );

  /**
   * 財務評価・ニュース分析はメインAI分析の完了後に自動で始まる。
   * メイン分析が失敗・上限到達・結果なしで終わったときは「完了後に表示します」と
   * 出し続けず、表示されない理由を伝える
   */
  const followUpUnavailableMessage = useMemo(() => {
    if (!searchResult) return null;
    if (analysisStatus === "error") {
      return "総合AI分析を完了できなかったため表示できません。上の「AI分析を再試行」からやり直せます。";
    }
    if (
      analysisStatus === "done" &&
      !(analysisResult && bundleTokens?.financial && bundleTokens?.news)
    ) {
      return "総合AI分析の結果を読み取れなかったため表示できません。時間をおいて、もう一度検索してください。";
    }
    if (analysisStatus === "idle" && !isAnalyzing && !canUseFeature) {
      return "本日の無料AI分析の回数を使い切ったため表示できません。明日以降、またはプレミアムプランでご利用いただけます。";
    }
    return null;
  }, [
    searchResult,
    analysisStatus,
    analysisResult,
    bundleTokens,
    isAnalyzing,
    canUseFeature,
  ]);

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
      error={error}
      // 「見つかりませんでした」は同じ語で再検索しても結果が変わらないため出さない
      onRetry={
        error && error !== NOT_FOUND_MESSAGE
          ? () => void retrySearch()
          : undefined
      }
    />
  );

  const watchlistSection = (
    <WatchlistSection
      watchlist={watchlist}
      onSelectCode={code => {
        void handlePickSelect(code);
      }}
      onRequestLogin={() => setShowAuthModal(true)}
    />
  );

  const digestSection = <DigestSection items={watchlist.items} />;

  const sampleStockSlot = !isLoading ? (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        迷ったら、サンプル銘柄をタップして体験できます
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {SAMPLE_STOCKS.map(stock => (
          <Button
            key={stock.symbol}
            variant="outline"
            size="sm"
            onClick={() => handleSelectSuggestion(stock.symbol, stock.name)}
            className="h-10 gap-2 font-medium transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
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
  ) : null;

  const stockIdeasSection = (
    <TopTradingValueSection
      items={tradingRanking}
      isLoading={isRankingLoading}
      error={rankingError}
      warning={rankingWarning}
      onSelect={handlePickSelect}
      onRetry={() => void refreshRanking()}
    />
  );

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* ロゴは一面（検索前の画面）に戻る導線を兼ねる */}
            <Link
              href="/"
              onClick={handleHomeLinkClick}
              aria-label={`${APP_NAME} トップへ戻る`}
              className="order-1 flex items-center space-x-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
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
            </Link>
            {/* スマホではロゴと操作ボタンを1行目、ナビを2行目に置いてヘッダーの高さを抑える */}
            <div className="order-3 w-full sm:order-2 sm:w-auto">
              <SignalsNav active="home" onHomeClick={handleHomeLinkClick} />
            </div>
            <div className="order-2 flex items-center space-x-2 sm:order-3 sm:space-x-4">
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
            digestSlot={digestSection}
            watchlistSlot={watchlistSection}
            pulseSlot={<LivePulseStrip />}
            stockIdeasSlot={stockIdeasSection}
            sampleSlot={sampleStockSlot}
            topIdea={tradingRanking[0]}
            stockIdeas={tradingRanking}
            isStockIdeasLoading={isRankingLoading}
            warning={rankingWarning}
            stockIdeasError={rankingError}
            onRetryStockIdeas={() => void refreshRanking()}
            remainingUses={remainingUses}
            dailyLimit={dailyLimit}
            isPremium={isPremium}
            onSelectIdea={handleFrontPageIdeaSelect}
          />
        ) : (
          <>
            {/* 別の銘柄をすぐ調べられるよう、検索欄は結果の上に置く */}
            {searchSection}
            <div className="mb-6">
              <StockPriceHeaderCard
                companyInfo={searchResult.companyInfo}
                stockData={searchResult.stockData}
                currency={getCurrencySymbol}
                isWatched={watchlist.has(searchResult.companyInfo.symbol)}
                onToggleWatch={() => {
                  // 未ログインで★を押しても無反応にならないよう、ログインを促す
                  if (!user) {
                    setShowAuthModal(true);
                    return;
                  }
                  const { symbol, name } = searchResult.companyInfo;
                  if (watchlist.isBusy(symbol)) return;
                  if (watchlist.has(symbol)) {
                    void watchlist.remove(symbol);
                  } else {
                    void watchlist.add(symbol, name);
                  }
                }}
              />
              {/* ★を押した結果（無料プランの上限など）は★のすぐ下に出す。
                  ウォッチリスト欄は画面のずっと下にあり、気付けなかった */}
              {user && watchlist.error && (
                <div
                  role="alert"
                  className="mt-2 flex items-start justify-between gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
                >
                  <span className="py-1">{watchlist.error}</span>
                  <button
                    type="button"
                    onClick={watchlist.clearError}
                    className="-my-1 min-h-11 shrink-0 px-2 text-xs underline"
                  >
                    閉じる
                  </button>
                </div>
              )}
            </div>

            <DataStatusCard
              items={dataStatusItems}
              fetchedAt={searchResult.metadata?.fetchedAt}
              isRetrying={isLoading}
              onRetry={() =>
                void searchCompany(searchResult.companyInfo.symbol, chartPeriod)
              }
            />

            {/* 無料プラン案内：残り回数と、プレミアムで何が増えるかを具体的に示す */}
            {!isPremium && (
              <div className="mb-6 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>無料プラン: AI分析は1日{dailyLimit}回まで</span>
                  <span
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                      canUseFeature
                        ? "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200"
                    }`}
                  >
                    残り{remainingUses}/{dailyLimit}回
                  </span>
                </div>
                <p className="mt-2 flex items-start gap-1.5 text-xs text-green-900/80 dark:text-green-200/80">
                  <Crown className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    プレミアムならAI分析が回数無制限、ウォッチリストも無制限（無料は
                    {FREE_WATCHLIST_LIMIT}
                    銘柄）で、朝ダイジェストの対象を増やせます。
                  </span>
                </p>
              </div>
            )}
          </>
        )}

        {/* メインAI分析のエラー（検索のエラーは検索欄の直下に出す） */}
        {searchResult && analysisError && (
          <Card className="mb-6 border-destructive bg-destructive/5">
            <CardContent className="pt-6">
              <div
                role="alert"
                className="flex items-start gap-3 text-destructive"
              >
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">AI分析を完了できませんでした</p>
                  <p className="text-sm mt-1">{analysisError}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => void handleRetryAnalysis()}
                      className="min-h-11 text-sm px-4 py-2 bg-destructive/10 hover:bg-destructive/20 rounded-md transition-colors"
                    >
                      AI分析を再試行
                    </button>
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
                {/* アプリの売りであるAI要約をスマホでも最初に見せる */}
                <AskSection
                  isAnalyzing={isAnalyzing}
                  streamingText={streamingText}
                  analysisResult={analysisResult}
                  canUseFeature={canUseFeature}
                  remainingUses={remainingUses}
                  dailyLimit={dailyLimit}
                  isPremium={isPremium}
                  currencySymbol={getCurrencySymbol}
                  referenceLabels={aiReferenceLabels}
                  analyzedAt={analyzedAt}
                />

                {/* チャートセクション */}
                <StockChart
                  symbol={searchResult.companyInfo.symbol}
                  data={searchResult.chartData}
                  isLoading={isLoading}
                  currency={getCurrencySymbol}
                  onPeriodChange={handleChartPeriodChange}
                />

                {/* 会社概要セクション（日本株は「プライム / 輸送用機器」のような
                    市場・業種だけのことが多いので、その場合は見出しを変え、
                    押しても何も変わらない「続きを読む」は出さない） */}
                {companyProfile && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">
                          {companyProfile.title}
                        </CardTitle>
                        {companyProfile.collapsible && (
                          <button
                            type="button"
                            onClick={() =>
                              setIsDescriptionExpanded(!isDescriptionExpanded)
                            }
                            aria-expanded={isDescriptionExpanded}
                            aria-controls="company-description"
                            className="-my-2 flex min-h-11 items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p
                        id="company-description"
                        className={`text-sm text-muted-foreground leading-relaxed ${
                          companyProfile.collapsible && !isDescriptionExpanded
                            ? "line-clamp-10"
                            : ""
                        }`}
                      >
                        {companyProfile.text}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* 無料で見られる業績サマリー */}
                <FreePerformanceSummary
                  financialData={searchResult.financialData}
                  ratios={searchResult.ratios}
                  financialHistory={searchResult.financialHistory}
                  currencySymbol={getCurrencySymbol}
                  hidePerformanceComment={
                    isAnalyzing ||
                    Boolean(analysisResult) ||
                    Boolean(streamingText.trim())
                  }
                />

                {/* 財務健全性（BS/PL/CF）評価 */}
                <FinancialEvaluationSection
                  financialEval={financialEval}
                  isFinancialLoading={isFinancialLoading}
                  financialError={financialError}
                  unavailableMessage={followUpUnavailableMessage}
                  onRetry={retryFinancialEval}
                  getScoreLabel={getScoreLabel}
                  getScoreColor={getScoreColor}
                />

                {/* ニュースセクション */}
                <NewsSection
                  newsAnalysis={newsAnalysis}
                  analyzedNews={analyzedNews}
                  newsData={searchResult.newsData}
                  isNewsAnalyzing={isNewsAnalyzing}
                  newsError={newsError}
                  newsEmpty={newsEmpty}
                  unavailableMessage={followUpUnavailableMessage}
                  onRetryNews={retryNewsAnalysis}
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
                showPriceHeader={false}
                dividendYield={searchResult.ratios?.dividendYield ?? null}
              />
            </div>
          </div>
        )}

        {/* 市場全体の情報とウォッチリストは、銘柄の分析結果より後ろに置く */}
        {searchResult && (
          <div className="mt-6 space-y-6">
            {watchlistSection}
            <LivePulseStrip />
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
