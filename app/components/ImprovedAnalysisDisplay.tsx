"use client";

import { useState } from "react";
import { AnalysisSection } from "./AnalysisSection";
import { InvestmentRecommendation } from "./AnalysisSection";
import { MetricCard } from "./AnalysisSection";
import { ProgressBar } from "./AnalysisSection";
import { ComparisonModal } from "./AnalysisSection";
import { DataStatus } from "./DataStatus";
import { DataQualityIndicator } from "./DataStatus";
import { ErrorNotification } from "./DataStatus";
import {
  AnalysisErrorBoundary,
  LoadingState,
  EmptyState,
} from "./ErrorBoundary";
import {
  ReadableAnalysisSection,
  HighlightedData,
  KeyPoints,
  RiskOpportunity,
} from "./ReadableAnalysisSection";
import { ActionBar, Tooltip } from "./InteractiveElements";

interface ImprovedAnalysisDisplayProps {
  analysisData: any;
  stockCode: string;
  companyName: string;
  market: string;
}

export function ImprovedAnalysisDisplay({
  analysisData,
  stockCode,
  companyName,
  market,
}: ImprovedAnalysisDisplayProps) {
  const [errors, setErrors] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  const dismissError = (index: number) => {
    setErrors(prev => prev.filter((_, i) => i !== index));
  };

  // データ品質の計算
  const calculateDataQuality = () => {
    const confidence = analysisData.aiScores?.aiConfidence || 0;
    const completeness = calculateCompleteness();
    const recency = calculateRecency();

    return { confidence, completeness, recency };
  };

  const calculateCompleteness = () => {
    const fields = [
      analysisData.stockInfo?.price,
      analysisData.basicMetrics?.per,
      analysisData.basicMetrics?.roe,
      analysisData.companyOverview?.industry,
      analysisData.financialHealth?.debtToEquity,
      analysisData.marketSentiment?.sentiment,
    ];

    const filledFields = fields.filter(
      field =>
        field !== null && field !== undefined && field !== 0 && field !== ""
    ).length;

    return Math.round((filledFields / fields.length) * 100);
  };

  const calculateRecency = () => {
    const lastUpdated = new Date(
      analysisData.stockInfo?.lastUpdated || new Date()
    );
    const now = new Date();
    const diffHours =
      (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

    if (diffHours < 1) return 100;
    if (diffHours < 6) return 80;
    if (diffHours < 24) return 60;
    if (diffHours < 72) return 40;
    return 20;
  };

  const dataQuality = calculateDataQuality();

  return (
    <AnalysisErrorBoundary>
      <div className="max-w-6xl mx-auto p-6">
        {/* ヘッダー */}
        <div className="mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {stockCode} ({companyName})
              </h1>
              <p className="text-gray-600 mt-1">
                {market === "JP" ? "日本株" : "米国株"} •{" "}
                {analysisData.stockInfo?.market || market}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <ActionBar
                stockCode={stockCode}
                companyName={companyName}
                currentPrice={analysisData.stockInfo?.price}
                shareUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/analysis/${stockCode}`}
              />
              <button
                onClick={() => setShowComparison(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                銘柄比較
              </button>
            </div>
          </div>

          {/* データステータス */}
          <DataStatus
            lastUpdated={
              analysisData.stockInfo?.lastUpdated || new Date().toISOString()
            }
            dataSource={analysisData.stockInfo?.dataSource || "AI Analysis"}
            isRealTime={false}
          />

          {/* データ品質インジケーター */}
          <DataQualityIndicator
            confidence={dataQuality.confidence}
            completeness={dataQuality.completeness}
            recency={dataQuality.recency}
          />
        </div>

        {/* エラー通知 */}
        <ErrorNotification errors={errors} onDismiss={dismissError} />

        {/* 分析セクション */}
        <div className="space-y-6">
          {/* 1. 投資判断（最優先） - 読みやすい形式 */}
          <ReadableAnalysisSection
            title="AI投資判断"
            content={analysisData.aiSummary || "分析中..."}
            icon="🎯"
            defaultExpanded={true}
          />

          {/* 2. 基本指標 - 改善された表示 */}
          <AnalysisSection
            title="基本指標"
            priority={2}
            icon="📈"
            defaultExpanded={true}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Tooltip content="現在の株価（最新の取引価格）">
                <div>
                  <HighlightedData
                    label="株価"
                    value={analysisData.stockInfo?.price || 0}
                    unit="円"
                    change={analysisData.stockInfo?.changePercent}
                    color="blue"
                  />
                </div>
              </Tooltip>
              <Tooltip content="株価収益率 - 株価が1株当たり利益の何倍かを示す指標">
                <div>
                  <HighlightedData
                    label="PER"
                    value={analysisData.basicMetrics?.per || 0}
                    color="green"
                  />
                </div>
              </Tooltip>
              <Tooltip content="自己資本利益率 - 自己資本に対する利益の割合">
                <div>
                  <HighlightedData
                    label="ROE"
                    value={analysisData.basicMetrics?.roe || 0}
                    unit="%"
                    color="blue"
                  />
                </div>
              </Tooltip>
              <Tooltip content="配当利回り - 株価に対する年間配当金の割合">
                <div>
                  <HighlightedData
                    label="配当利回り"
                    value={analysisData.basicMetrics?.dividendYield || 0}
                    unit="%"
                    color="red"
                  />
                </div>
              </Tooltip>
            </div>
          </AnalysisSection>

          {/* 3. AIスコア */}
          <AnalysisSection title="AIスコア" priority={2} icon="🤖">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <ProgressBar
                  value={analysisData.aiScores?.totalScore || 0}
                  max={10}
                  label="総合スコア"
                  color="blue"
                />
                <ProgressBar
                  value={analysisData.aiScores?.growthPotential || 0}
                  max={10}
                  label="成長性"
                  color="green"
                />
                <ProgressBar
                  value={analysisData.aiScores?.profitability || 0}
                  max={10}
                  label="収益性"
                  color="yellow"
                />
              </div>
              <div>
                <ProgressBar
                  value={analysisData.aiScores?.stability || 0}
                  max={10}
                  label="安定性"
                  color="blue"
                />
                <ProgressBar
                  value={analysisData.aiScores?.value || 0}
                  max={10}
                  label="バリュー"
                  color="red"
                />
                <ProgressBar
                  value={dataQuality.confidence}
                  max={100}
                  label="AI信頼度"
                  color="green"
                  showPercentage={false}
                />
              </div>
            </div>
          </AnalysisSection>

          {/* 4. 市場センチメント */}
          <AnalysisSection title="市場センチメント" priority={3} icon="📊">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                title="ニューススコア"
                value={analysisData.marketSentiment?.newsScore || 0}
                color="blue"
              />
              <MetricCard
                title="アナリスト評価"
                value={analysisData.marketSentiment?.analystRating || 0}
                color="green"
              />
              <MetricCard
                title="SNS普及"
                value={analysisData.marketSentiment?.socialMention || 0}
                color="yellow"
              />
              <MetricCard
                title="機関フロー"
                value={analysisData.marketSentiment?.institutionalFlow || 0}
                color="red"
              />
            </div>
          </AnalysisSection>

          {/* 5. 財務健全性 */}
          <AnalysisSection title="財務健全性" priority={3} icon="💰">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                title="D/E比率"
                value={analysisData.financialHealth?.debtToEquity || 0}
                color="red"
                description="負債自己資本比率"
              />
              <MetricCard
                title="流動比率"
                value={analysisData.financialHealth?.currentRatio || 0}
                color="green"
              />
              <MetricCard
                title="キャッシュフロー"
                value={analysisData.financialHealth?.cashFlow || 0}
                color="blue"
              />
              <MetricCard
                title="インタレストカバレッジ"
                value={analysisData.financialHealth?.interestCoverage || 0}
                color="yellow"
              />
            </div>
          </AnalysisSection>

          {/* 6. 企業情報 */}
          <AnalysisSection title="企業情報" priority={4} icon="🏢">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">基本情報</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">業界:</span>{" "}
                    {analysisData.companyOverview?.industry || "情報取得中"}
                  </div>
                  <div>
                    <span className="font-medium">設立:</span>{" "}
                    {analysisData.companyOverview?.founded || "情報取得中"}
                  </div>
                  <div>
                    <span className="font-medium">従業員数:</span>{" "}
                    {analysisData.companyOverview?.employees?.toLocaleString() ||
                      "情報取得中"}
                    人
                  </div>
                  <div>
                    <span className="font-medium">本社:</span>{" "}
                    {analysisData.companyOverview?.headquarters || "情報取得中"}
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-3">事業内容</h4>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {analysisData.companyOverview?.description ||
                    "企業情報を分析中です..."}
                </p>
              </div>
            </div>
          </AnalysisSection>

          {/* 7. リスク・機会 - 改善された表示 */}
          <AnalysisSection title="リスク・機会" priority={4} icon="⚠️">
            <RiskOpportunity
              risks={analysisData.risks || ["リスク情報を分析中..."]}
              opportunities={
                analysisData.opportunities || ["機会情報を分析中..."]
              }
            />
          </AnalysisSection>
        </div>

        {/* 比較モーダル */}
        <ComparisonModal
          isOpen={showComparison}
          onClose={() => setShowComparison(false)}
          currentStock={analysisData.stockInfo}
          comparisonStocks={[]}
        />

        {/* フッター */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            本内容は情報提供のみを目的としており、投資勧誘を目的としたものではありません。
            投資判断は自己責任で行ってください。
          </p>
        </div>
      </div>
    </AnalysisErrorBoundary>
  );
}
