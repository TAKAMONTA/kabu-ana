"use client";

import React from "react";
import type { AIAnalysisData } from "@/app/types/ai";
import {
  ReadableAnalysisSection,
  HighlightedData,
  KeyPoints,
  RiskOpportunity,
} from "@/app/components/ReadableAnalysisSection";

interface Props {
  analysisData: AIAnalysisData;
  stockCode: string;
  companyName: string;
  market: string;
}

export default function ReadableAnalysisDisplay({
  analysisData,
  stockCode,
  companyName,
  market,
}: Props) {
  const {
    stockInfo,
    companyOverview,
    basicMetrics,
    aiScores,
    marketSentiment,
  } = analysisData;

  const shortTermTip = () => {
    const tipBase =
      basicMetrics.per && basicMetrics.per > 20
        ? "短期は好材料で上振れ、悪材料で下振れが出やすい。"
        : "短期はレンジ内の動きが想定されやすい。";
    return `${tipBase} 指標(${basicMetrics.per ? `PER ${basicMetrics.per}倍` : "PER情報なし"})に注意。`;
  };

  const midTermTip = () => {
    const dy = basicMetrics.dividendYield || 0;
    return `配当${dy.toFixed(1)}%台を受け取りつつ、業績と評価の継続を狙う。`;
  };

  const longTermTip = () => {
    return "世界的なEV化・自動運転などの長期テーマに対し、財務の健全性と競争力の持続を重視。";
  };

  // 短期レンジの目安（±10%）
  const price = typeof stockInfo?.price === "number" ? stockInfo.price : 0;
  const pct = 0.1;
  const low = Math.max(0, Math.round(price * (1 - pct)));
  const high = Math.round(price * (1 + pct));
  const rangeLabel =
    price > 0 ? `${low.toLocaleString()} - ${high.toLocaleString()}` : "N/A";

  return (
    <div className="max-w-4xl mx-auto bg-white min-h-screen">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div>
          <h1 className="text-3xl font-bold">
            {companyName} ({stockCode}) 分析詳細
          </h1>
          <p className="text-blue-100 mt-2">
            {companyOverview?.industry || "業界"}セクターの包括的分析レポート
          </p>
        </div>

        {/* 短期レンジ（目安）と主要指標 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <HighlightedData
            label="短期レンジ（目安）"
            value={rangeLabel}
            unit={market === "US" ? "$" : "円"}
            color="gray"
          />
          <HighlightedData
            label="PER"
            value={basicMetrics?.per || 0}
            unit="倍"
            color="gray"
          />
          <HighlightedData
            label="ROE"
            value={basicMetrics?.roe || 0}
            unit="%"
            color="gray"
          />
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* 会社の位置づけ */}
        <ReadableAnalysisSection
          title="会社の位置づけ"
          icon="🏢"
          content={[
            `世界・国内でのポジション: ${companyOverview?.industry || "情報取得中"}セクターでの主要プレイヤー`,
            `ビジネス概要: ${companyOverview?.business || "主要事業を展開"}`,
            `${marketSentiment?.sentiment ? `市場評価: ${marketSentiment.sentiment}` : "市場評価: 情報取得中"}`,
          ].join("\n・ ")}
        />

        {/* 今の株価水準 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <HighlightedData
            label="現在株価"
            value={stockInfo?.price || 0}
            unit={market === "US" ? "$" : "円"}
            change={
              typeof stockInfo?.changePercent === "number"
                ? stockInfo.changePercent
                : undefined
            }
            color="blue"
          />
          <HighlightedData
            label="時価総額"
            value={basicMetrics?.marketCap || 0}
            unit={market === "US" ? "$" : "億円"}
            color="gray"
          />
          <HighlightedData
            label="配当利回り"
            value={basicMetrics?.dividendYield || 0}
            unit="%"
            color="green"
          />
        </div>

        {/* 短期レンジ（目安）と主要指標 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <HighlightedData
            label="短期レンジ（目安）"
            value={rangeLabel}
            unit={market === "US" ? "$" : "円"}
            color="gray"
          />
          <HighlightedData
            label="PER"
            value={basicMetrics?.per || 0}
            unit="倍"
            color="gray"
          />
          <HighlightedData
            label="ROE"
            value={basicMetrics?.roe || 0}
            unit="%"
            color="gray"
          />
        </div>

        {/* 強み・リスク */}
        <RiskOpportunity
          risks={
            analysisData.risks && analysisData.risks.length > 0
              ? analysisData.risks.slice(0, 6)
              : ["需要減少や景気後退に伴う販売鈍化", "新技術投資のコスト増加"]
          }
          opportunities={
            analysisData.opportunities && analysisData.opportunities.length > 0
              ? analysisData.opportunities.slice(0, 6)
              : ["新市場・新製品の展開", "技術革新による競争力強化"]
          }
        />

        {/* 投資家としての戦略 */}
        <ReadableAnalysisSection
          title="投資家としての戦略"
          icon="🧭"
          content={[
            "【短期（数週間〜数か月）】",
            `・${shortTermTip()}`,
            price > 0
              ? `・想定レンジ: ${rangeLabel}${market === "US" ? " $" : " 円"}`
              : "",
            "",
            "【中期（1〜3年）】",
            `・${midTermTip()}`,
            "",
            "【長期（5年以上）】",
            `・${longTermTip()}`,
          ].join("\n")}
        />

        {/* 重要ポイント */}
        <KeyPoints
          title="まとめ（大学生向けに一言）"
          points={[
            `${companyName}は『攻めの株』ではなく『守りの核』。長期で資産の土台に置きやすい。`,
            `短期はニュースや決算のサプライズに注意。配当と安定性が魅力。`,
            `スコア指標: 投資スコア${aiScores?.investmentScore ?? 50}/100、成長予測${aiScores?.growthPrediction ?? 5}/10、リスク評価${aiScores?.riskAssessment ?? 5}/10`,
          ]}
        />

        {/* 最終更新・ソース */}
        <div className="text-sm text-gray-500">
          <div>
            最終更新:{" "}
            {stockInfo?.lastUpdated || new Date().toLocaleString("ja-JP")}
          </div>
          {stockInfo?.dataSource && (
            <div>データソース: {stockInfo.dataSource}</div>
          )}
        </div>
      </div>
    </div>
  );
}
