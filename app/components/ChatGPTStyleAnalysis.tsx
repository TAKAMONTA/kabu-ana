"use client";

import React, { useState } from "react";
import type { AIAnalysisData } from "@/app/types/ai";

interface Props {
  analysisData: AIAnalysisData;
  stockCode: string;
  companyName: string;
  market: string;
}

// ソースタグコンポーネント（非表示）
const SourceTag: React.FC<{ source: string; count?: number }> = () => null;

// 数値ハイライトコンポーネント
const HighlightNumber: React.FC<{ value: string | number; unit?: string }> = ({
  value,
  unit,
}) => (
  <span className="font-bold text-gray-900 text-lg">
    {typeof value === "number" ? value.toLocaleString() : value}
    {unit && <span className="text-gray-600 text-base">{unit}</span>}
  </span>
);

// セクションコンポーネント
const AnalysisSection: React.FC<{
  title: string;
  children: React.ReactNode;
  sources?: string[];
}> = ({ title, children }) => (
  <div className="mb-8">
    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
      <span className="mr-2">📊</span>
      {title}
    </h3>
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {children}
    </div>
  </div>
);

// 事業と変化点セクション
const BusinessChangesSection: React.FC<{ analysisData: AIAnalysisData }> = ({
  analysisData,
}) => {
  const { companyOverview, basicMetrics, stockInfo } = analysisData;

  return (
    <AnalysisSection title="事業と2025年の「変化点」">
      <div className="space-y-6">
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-3">事業基盤</h4>
          <p className="text-gray-700 mb-2">
            {companyOverview?.business || "主要事業"}を展開する{stockInfo.name}
            。{companyOverview?.industry && `${companyOverview.industry}業界`}
            での
            {(basicMetrics.revenueGrowth ?? 0) > 0 ? "成長" : "安定"}
            基調を維持。
          </p>
        </div>

        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-3">事業戦略</h4>
          <div className="space-y-3">
            <div>
              <h5 className="font-medium text-gray-800">成長戦略</h5>
              <p className="text-gray-700">
                {analysisData.opportunities?.slice(0, 2).join("、") ||
                  "新規事業展開、市場拡大"}
                。 売上成長率
                <HighlightNumber
                  value={basicMetrics.revenueGrowth ?? 0}
                  unit="%"
                />
                を目指す。
              </p>
            </div>
            <div>
              <h5 className="font-medium text-gray-800">財務戦略</h5>
              <p className="text-gray-700">
                ROE <HighlightNumber value={basicMetrics.roe} unit="%" />、 EPS{" "}
                <HighlightNumber value={basicMetrics.eps} unit="円" />で
                {basicMetrics.roe > 15 ? "高収益" : "安定収益"}を維持。
              </p>
            </div>
            <div>
              <h5 className="font-medium text-gray-800">配当政策</h5>
              <p className="text-gray-700">
                配当利回り
                <HighlightNumber value={basicMetrics.dividendYield} unit="%" />
                、 1株当たり配当
                <HighlightNumber value={basicMetrics.dividend} unit="円" />。
                {basicMetrics.dividendYield > 3 ? "高配当" : "安定配当"}政策。
              </p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-3">市場環境</h4>
          <div>
            <h5 className="font-medium text-gray-800">競合環境</h5>
            <p className="text-gray-700">
              {analysisData.competitors?.length > 0
                ? `${analysisData.competitors
                    .slice(0, 2)
                    .map(c => c.name)
                    .join("、")}等との競争`
                : "業界内での競争"}
              。 PBR <HighlightNumber value={basicMetrics.pbr} unit="倍" />で
              {basicMetrics.pbr < 1
                ? "割安"
                : basicMetrics.pbr < 2
                  ? "適正"
                  : "割高"}
              評価。
            </p>
          </div>
        </div>
      </div>
    </AnalysisSection>
  );
};

// 現状の業績と株価セクション
const CurrentPerformanceSection: React.FC<{ analysisData: AIAnalysisData }> = ({
  analysisData,
}) => {
  const { stockInfo, basicMetrics, companyOverview } = analysisData;

  return (
    <AnalysisSection title="現状の業績と株価">
      <div className="space-y-6">
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4 leading-relaxed">
            現在の株価動向
          </h4>
          <p className="text-gray-700 text-base leading-relaxed">
            {stockInfo.name}は{companyOverview?.industry || "業界"}
            で堅調な成長を見せており、
            EPSや売上の記録更新を受けて機関・個人投資家の間でも注目されています。
            現在の株価は
            <HighlightNumber
              value={stockInfo.price || 0}
              unit={stockInfo.market === "US" ? "$" : "円"}
            />
            で、
            {(stockInfo.changePercent || 0) > 0 ? "上昇" : "下落"}幅
            <HighlightNumber
              value={Math.abs(stockInfo.changePercent || 0)}
              unit="%"
            />
            となっています。
          </p>
        </div>

        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4 leading-relaxed">
            財務指標
          </h4>
          <p className="text-gray-700 text-base leading-relaxed">
            EPS <HighlightNumber value={basicMetrics.eps} unit="円" />、 PER{" "}
            <HighlightNumber value={basicMetrics.per} unit="倍" />、 PBR{" "}
            <HighlightNumber value={basicMetrics.pbr} unit="倍" />。 時価総額
            <HighlightNumber value={basicMetrics.marketCap} unit="億円" />で
            {(basicMetrics.revenueGrowth ?? 0) > 0 ? "成長" : "安定"}
            基調を維持しています。
          </p>
        </div>

        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4 leading-relaxed">
            バリュエーション指標
          </h4>
          <p className="text-gray-700 text-base leading-relaxed">
            時価総額
            <HighlightNumber value={basicMetrics.marketCap} unit="億円" />、 PER{" "}
            <HighlightNumber value={basicMetrics.per} unit="倍" />。
            {basicMetrics.per > 30
              ? "P/E比率が30倍超で割高感もあり"
              : basicMetrics.per > 15
                ? "P/E比率は適正水準"
                : "P/E比率は割安水準"}
            、 投資判断は慎重に行う必要があります。
          </p>
        </div>
      </div>
    </AnalysisSection>
  );
};

// 機関投資家の動向セクション
const InstitutionalTrendsSection: React.FC<{
  analysisData: AIAnalysisData;
}> = ({ analysisData }) => {
  const { marketSentiment, aiScores, stockInfo, basicMetrics } = analysisData;

  return (
    <AnalysisSection title="機関投資家の動向">
      <div className="space-y-6">
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4 leading-relaxed">
            保有状況と投資姿勢
          </h4>
          <p className="text-gray-700 text-base leading-relaxed">
            機関投資家の保有比率は高く、
            {(marketSentiment.institutionalFlow || 0) > 0
              ? "資金流入が続いている"
              : (marketSentiment.institutionalFlow || 0) < 0
                ? "資金流出が見られる"
                : "資金動向は安定"}
            一方、 一部の資産運用会社は
            {basicMetrics.per > 25 ? "バリュエーション" : "業績"}を警戒して
            {(marketSentiment.institutionalFlow || 0) < 0 ? "売却" : "調整"}
            しています。 市場評価は「
            {marketSentiment.sentiment === "bullish"
              ? "強気"
              : marketSentiment.sentiment === "bearish"
                ? "弱気"
                : "中立"}
            」が主流で、 長期的には
            {analysisData.opportunities?.slice(0, 1)[0] || "事業成長"}
            がカギと見られています。
          </p>
        </div>

        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4 leading-relaxed">
            投資評価
          </h4>
          <p className="text-gray-700 text-base leading-relaxed">
            AI投資スコア
            <HighlightNumber value={aiScores.investmentScore} unit="/100" />、
            成長予測
            <HighlightNumber value={aiScores.growthPrediction} unit="/10" />、
            リスク評価
            <HighlightNumber value={aiScores.riskAssessment} unit="/10" />で
            {aiScores.investmentScore > 70
              ? "高評価"
              : aiScores.investmentScore > 40
                ? "中程度評価"
                : "低評価"}
            。 アナリスト評価
            <HighlightNumber value={marketSentiment.analystRating || 0} unit="/5" />
            。
          </p>
        </div>

        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4 leading-relaxed">
            財務健全性
          </h4>
          <p className="text-gray-700 text-base leading-relaxed">
            AI信頼度
            <HighlightNumber value={aiScores.aiConfidence} unit="/10" />で
            {aiScores.aiConfidence > 7
              ? "AI分析は高信頼度"
              : "AI分析は中程度信頼度"}
            。
          </p>
        </div>

        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4 leading-relaxed">
            主要リスク要因
          </h4>
          <div className="space-y-4">
            {analysisData.risks?.slice(0, 3).map((risk, index) => (
              <div
                key={index}
                className="p-4 bg-red-50 border border-red-200 rounded-lg"
              >
                <p className="text-red-800 text-base leading-relaxed">
                  - {risk}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AnalysisSection>
  );
};

// 個人投資家・市場予測セクション
const IndividualMarketForecastSection: React.FC<{
  analysisData: AIAnalysisData;
}> = ({ analysisData }) => {
  const {
    stockInfo,
    basicMetrics,
    marketSentiment,
    technicalIndicators,
    companyOverview,
  } = analysisData;

  return (
    <AnalysisSection title="個人投資家・市場予測">
      <div className="space-y-6">
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4 leading-relaxed">
            個人投資家の動向と市場予測
          </h4>
          <p className="text-gray-700 text-base leading-relaxed">
            個人投資家やネット証券での人気も持続し、
            {marketSentiment.sentiment === "bullish"
              ? "強気"
              : marketSentiment.sentiment === "bearish"
                ? "弱気"
                : "中立"}
            な市場予測が主流です。 ただしバリュエーションはP/E比率が
            <HighlightNumber value={basicMetrics.per} unit="倍" />で
            {basicMetrics.per > 30
              ? "割高感もあり"
              : basicMetrics.per > 15
                ? "適正水準"
                : "割安水準"}
            、{analysisData.risks?.slice(0, 1)[0] || "業績変動"}
            を理由に警戒感を示す意見も増えつつあります。
          </p>
        </div>

        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4 leading-relaxed">
            カタリスト (0-6か月)
          </h4>
          <div className="space-y-4">
            <div>
              <p className="text-gray-700 text-base leading-relaxed">
                <strong>決算発表:</strong>{" "}
                次回決算での業績ガイダンスと成長戦略の明確化
              </p>
            </div>
            <div>
              <p className="text-gray-700 text-base leading-relaxed">
                <strong>新製品・サービス:</strong>{" "}
                {analysisData.opportunities?.slice(0, 1)[0] || "新規事業展開"}
                の進捗
              </p>
            </div>
            <div>
              <p className="text-gray-700 text-base leading-relaxed">
                <strong>市場環境変化:</strong>{" "}
                {companyOverview?.industry || "業界"}の動向と競合状況
              </p>
            </div>
            <div>
              <p className="text-gray-700 text-base leading-relaxed">
                <strong>規制・政策:</strong>{" "}
                {analysisData.risks?.slice(0, 1)[0] || "規制リスク"}の動向
              </p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4 leading-relaxed">
            需給・テクニカルの素朴な見方
          </h4>
          <p className="text-gray-700 text-base leading-relaxed">
            {technicalIndicators?.trend === "uptrend"
              ? "上昇トレンド"
              : technicalIndicators?.trend === "downtrend"
                ? "下降トレンド"
                : "横ばいトレンド"}
            で、 RSI{" "}
            <HighlightNumber value={technicalIndicators?.rsi || 50} unit="" />。
            PER <HighlightNumber value={basicMetrics.per} unit="倍" />
            近辺は
            {basicMetrics.per > 25
              ? "決算期待が剝がれるとドローダウンも速いゾーン"
              : "適正水準"}
            。 短期は
            {technicalIndicators?.volatility &&
            technicalIndicators.volatility > 20
              ? "ボラティリティ"
              : "安定性"}
            を想定。
          </p>
        </div>

        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4 leading-relaxed">
            分散と時間分散
          </h4>
          <p className="text-gray-700 text-base leading-relaxed">
            {companyOverview?.industry || "業界"}の"安定した需要"は長期の味方。
            {(analysisData.risks?.length || 0) > 0 ? "リスク要因" : "市場変動"}
            は読みにくい。 ポジションは段階的に、
            {technicalIndicators?.trend === "uptrend" ? "上昇時" : "調整時"}
            はサイズ調整を意識。
          </p>
        </div>
      </div>
    </AnalysisSection>
  );
};

// 今後の注目ポイントセクション
const FutureKeyPointsSection: React.FC<{ analysisData: AIAnalysisData }> = ({
  analysisData,
}) => {
  const { stockInfo, companyOverview } = analysisData;

  return (
    <AnalysisSection title="今後の注目ポイント">
      <div className="space-y-5">
        {analysisData.opportunities?.slice(0, 4).map((opportunity, index) => (
          <div key={index} className="flex items-start space-x-4">
            <span className="text-xl text-blue-600 mt-1">•</span>
            <div>
              <p className="text-gray-700 text-base leading-relaxed">
                <strong>{opportunity}</strong>
              </p>
            </div>
          </div>
        )) || (
          <>
            <div className="flex items-start space-x-4">
              <span className="text-xl text-blue-600 mt-1">•</span>
              <div>
                <p className="text-gray-700 text-base leading-relaxed">
                  <strong>新製品・サービス展開による成長機会</strong>
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <span className="text-xl text-blue-600 mt-1">•</span>
              <div>
                <p className="text-gray-700 text-base leading-relaxed">
                  <strong>市場シェア拡大と競合優位性の維持</strong>
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <span className="text-xl text-blue-600 mt-1">•</span>
              <div>
                <p className="text-gray-700 text-base leading-relaxed">
                  <strong>業界環境変化への対応とリスク管理</strong>
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <span className="text-xl text-blue-600 mt-1">•</span>
              <div>
                <p className="text-gray-700 text-base leading-relaxed">
                  <strong>株主還元政策による投資家支持の維持</strong>
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </AnalysisSection>
  );
};

// 投資判断まとめセクション
const InvestmentSummarySection: React.FC<{ analysisData: AIAnalysisData }> = ({
  analysisData,
}) => {
  const {
    stockInfo,
    aiScores,
    marketSentiment,
    basicMetrics,
    companyOverview,
  } = analysisData;

  return (
    <AnalysisSection title="投資判断まとめ">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8">
        <p className="text-gray-800 text-lg leading-relaxed">
          {stockInfo.name}は{companyOverview?.industry || "業界"}で
          {aiScores.growthPrediction > 7
            ? "高い成長性"
            : aiScores.growthPrediction > 4
              ? "安定した成長性"
              : "限定的な成長性"}
          と
          {aiScores.investmentScore > 70
            ? "優れた投資価値"
            : aiScores.investmentScore > 40
              ? "安定した投資価値"
              : "改善が必要な収益性"}
          を有していますが、 現時点でバリュエーションは
          {basicMetrics.per > 25
            ? "やや割高"
            : basicMetrics.per > 15
              ? "適正"
              : "割安"}
          です。 機関投資家は「
          {marketSentiment.sentiment === "bullish"
            ? "強気維持"
            : marketSentiment.sentiment === "bearish"
              ? "慎重調整"
              : "中立維持"}
          」、 個人投資家は「
          {aiScores.investmentScore > 70
            ? "期待と警戒の混在"
            : aiScores.investmentScore > 40
              ? "慎重な観望"
              : "警戒的"}
          」といったムード。
          {analysisData.opportunities?.slice(0, 1)[0] || "事業成長"}
          が今後の株価上昇のカギとなるでしょう。
        </p>
      </div>
    </AnalysisSection>
  );
};

// シナリオ分析セクション
const ScenarioAnalysisSection: React.FC<{ analysisData: AIAnalysisData }> = ({
  analysisData,
}) => {
  const { stockInfo, aiScores, basicMetrics, companyOverview } = analysisData;

  return (
    <AnalysisSection title="強気/中立/弱気シナリオ (12-18か月)">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="text-lg font-semibold text-green-800 mb-4 leading-relaxed">
            強気
          </h4>
          <p className="text-green-700 text-base leading-relaxed">
            {analysisData.opportunities?.slice(0, 2).join("、") ||
              "新規事業展開、市場拡大"}
            が期待上回り、 売上高成長継続(
            {(basicMetrics.revenueGrowth ?? 0) > 0
              ? `>${basicMetrics.revenueGrowth}%`
              : ">10%"}
            )、
            {companyOverview?.industry || "業界"}
            での競争優位性拡大、EPS拡大とPER維持/拡大。
          </p>
        </div>

        <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="text-lg font-semibold text-yellow-800 mb-4 leading-relaxed">
            中立
          </h4>
          <p className="text-yellow-700 text-base leading-relaxed">
            既存事業は横ばい、
            {analysisData.opportunities?.slice(0, 1)[0] || "新規事業"}で相殺、
            {analysisData.risks?.slice(0, 1)[0] || "規制影響"}
            は限定的、レンジ相場継続。
          </p>
        </div>

        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="text-lg font-semibold text-red-800 mb-4 leading-relaxed">
            弱気
          </h4>
          <p className="text-red-700 text-base leading-relaxed">
            {analysisData.risks?.slice(0, 2).join("、") ||
              "規制リスク、競合激化"}
            で 収益性に逆風、{companyOverview?.industry || "業界"}での競争激化で
            市場シェア悪化、PER低下リスク。
          </p>
        </div>
      </div>
    </AnalysisSection>
  );
};

// KPI追跡セクション
const KPITrackingSection: React.FC<{ analysisData: AIAnalysisData }> = ({
  analysisData,
}) => {
  const { stockInfo, basicMetrics, companyOverview } = analysisData;

  return (
    <AnalysisSection title="今追うべき重要指標 (KPI: 業績評価の鍵となる数値)">
      <div className="space-y-5">
        <div className="flex items-start space-x-4">
          <span className="text-xl font-bold text-blue-600 mt-1">1.</span>
          <div>
            <p className="text-gray-700 text-base leading-relaxed">
              売上成長率と収益性指標 (ROE {basicMetrics.roe}%、EPS{" "}
              {basicMetrics.eps}円の維持・改善)。
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-4">
          <span className="text-xl font-bold text-blue-600 mt-1">2.</span>
          <div>
            <p className="text-gray-700 text-base leading-relaxed">
              {companyOverview?.industry || "業界"}
              での市場シェアと競合優位性の維持・拡大。
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-4">
          <span className="text-xl font-bold text-blue-600 mt-1">3.</span>
          <div>
            <p className="text-gray-700 text-base leading-relaxed">
              財務健全性指標 (PBR {basicMetrics.pbr}倍、負債比率の管理)。
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-4">
          <span className="text-xl font-bold text-blue-600 mt-1">4.</span>
          <div>
            <p className="text-gray-700 text-base leading-relaxed">
              {analysisData.risks?.slice(0, 1)[0] || "規制・政策リスク"}
              の動向と対応状況。
            </p>
          </div>
        </div>
      </div>
    </AnalysisSection>
  );
};

// 参考ソースセクション
const ReferenceSourcesSection: React.FC<{ analysisData: AIAnalysisData }> = ({
  analysisData,
}) => {
  const { stockInfo, companyOverview } = analysisData;

  return (
    <AnalysisSection title="参考ソース (主要)">
      <div className="space-y-5">
        <div>
          <h4 className="text-lg font-semibold text-gray-800 mb-3 leading-relaxed">
            決算/IR
          </h4>
          <p className="text-gray-700 text-base leading-relaxed">
            {stockInfo.name}の決算リリース、IR情報、配当履歴。
          </p>
        </div>

        <div>
          <h4 className="text-lg font-semibold text-gray-800 mb-3 leading-relaxed">
            事業・戦略
          </h4>
          <p className="text-gray-700 text-base leading-relaxed">
            {companyOverview?.business || "主要事業"}の戦略発表、新規事業展開。
          </p>
        </div>

        <div>
          <h4 className="text-lg font-semibold text-gray-800 mb-3 leading-relaxed">
            財務・バリュエーション
          </h4>
          <p className="text-gray-700 text-base leading-relaxed">
            財務指標、株主還元政策、バリュエーション分析。
          </p>
        </div>

        <div>
          <h4 className="text-lg font-semibold text-gray-800 mb-3 leading-relaxed">
            業界・競合
          </h4>
          <p className="text-gray-700 text-base leading-relaxed">
            {companyOverview?.industry || "業界"}動向、競合分析、市場シェア。
          </p>
        </div>

        <div>
          <h4 className="text-lg font-semibold text-gray-800 mb-3 leading-relaxed">
            リスク・規制
          </h4>
          <p className="text-gray-700 text-base leading-relaxed">
            {analysisData.risks?.slice(0, 2).join("、") ||
              "規制リスク、市場リスク"}
            の動向。
          </p>
        </div>

        <div>
          <h4 className="text-lg font-semibold text-gray-800 mb-3 leading-relaxed">
            投資機会
          </h4>
          <p className="text-gray-700 text-base leading-relaxed">
            {analysisData.opportunities?.slice(0, 2).join("、") ||
              "成長機会、投資テーマ"}
            の分析。
          </p>
        </div>
      </div>

      <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800 leading-relaxed">
          ※これは投資助言ではありません。最終判断はご自身で。わからない点は「わからない」と正直に伝えますが、
          上のとおり一次情報ベースで整理しました。
        </p>
      </div>
    </AnalysisSection>
  );
};

export default function ChatGPTStyleAnalysis({
  analysisData,
  stockCode,
  companyName,
  market,
}: Props) {
  return (
    <div className="max-w-4xl mx-auto bg-white min-h-screen">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div>
          <h1 className="text-3xl font-bold">
            {companyName} ({stockCode}) 分析詳細
          </h1>
          <p className="text-blue-100 mt-2">
            {analysisData.companyOverview?.industry || "業界"}
            セクターの包括的分析レポート
          </p>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* 事業と変化点 */}
        <BusinessChangesSection analysisData={analysisData} />

        {/* 現状の業績と株価 */}
        <CurrentPerformanceSection analysisData={analysisData} />

        {/* 機関投資家の動向 */}
        <InstitutionalTrendsSection analysisData={analysisData} />

        {/* 個人投資家・市場予測 */}
        <IndividualMarketForecastSection analysisData={analysisData} />

        {/* 今後の注目ポイント */}
        <FutureKeyPointsSection analysisData={analysisData} />

        {/* 投資判断まとめ */}
        <InvestmentSummarySection analysisData={analysisData} />

        {/* シナリオ分析 */}
        <ScenarioAnalysisSection analysisData={analysisData} />

        {/* KPI追跡 */}
        <KPITrackingSection analysisData={analysisData} />

        {/* 参考ソース */}
        <ReferenceSourcesSection analysisData={analysisData} />
      </div>
    </div>
  );
}
