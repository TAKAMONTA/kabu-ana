"use client";

import { useState } from "react";

interface SimpleAnalysisDisplayProps {
  analysisData: any;
  stockCode: string;
  companyName: string;
  market: string;
}

export function SimpleAnalysisDisplay({
  analysisData,
  stockCode,
  companyName,
  market,
}: SimpleAnalysisDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);

  // 投資判断を分かりやすく変換
  const getInvestmentAdvice = (recommendation: string) => {
    switch (recommendation?.toLowerCase()) {
      case "buy":
      case "strong_buy":
        return { text: "買い", color: "text-green-600", bg: "bg-green-50", icon: "📈" };
      case "sell":
      case "strong_sell":
        return { text: "売り", color: "text-red-600", bg: "bg-red-50", icon: "📉" };
      case "hold":
      default:
        return { text: "様子見", color: "text-yellow-600", bg: "bg-yellow-50", icon: "⏸️" };
    }
  };

  // 数値を分かりやすく表示
  const formatNumber = (value: number, unit: string = "") => {
    if (!value || value === 0) return "データなし";
    if (unit === "%") return `${value.toFixed(1)}%`;
    if (unit === "円") return `${value.toLocaleString()}円`;
    return value.toLocaleString();
  };

  // 株価の変動を分かりやすく表示
  const getPriceChange = (change: number) => {
    if (!change) return null;
    const isPositive = change > 0;
    return {
      text: `${isPositive ? "+" : ""}${change.toFixed(2)}%`,
      color: isPositive ? "text-green-600" : "text-red-600",
      icon: isPositive ? "↗️" : "↘️"
    };
  };

  const investmentAdvice = getInvestmentAdvice(analysisData.aiScores?.recommendation);
  const priceChange = getPriceChange(analysisData.stockInfo?.changePercent);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {companyName}
            </h1>
            <p className="text-gray-600 mt-1">
              {stockCode} • {market === "JP" ? "日本株" : "米国株"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">
              {formatNumber(analysisData.stockInfo?.price, "円")}
            </div>
            {priceChange && (
              <div className={`flex items-center justify-end mt-1 ${priceChange.color}`}>
                <span className="mr-1">{priceChange.icon}</span>
                <span className="text-sm font-medium">{priceChange.text}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 投資判断（最重要） */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-3">🎯</span>
          <h2 className="text-xl font-bold text-gray-900">AI投資判断</h2>
        </div>
        
        <div className={`${investmentAdvice.bg} rounded-lg p-4 mb-4`}>
          <div className="flex items-center">
            <span className="text-2xl mr-3">{investmentAdvice.icon}</span>
            <div>
              <div className={`text-2xl font-bold ${investmentAdvice.color}`}>
                {investmentAdvice.text}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                AIが分析した投資判断です
              </p>
            </div>
          </div>
        </div>

        {/* 簡潔な理由 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">判断理由</h3>
          <p className="text-gray-700 text-sm leading-relaxed">
            {analysisData.aiSummary || "分析中..."}
          </p>
        </div>
      </div>

      {/* 基本指標（簡素化） */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-3">📊</span>
          <h2 className="text-xl font-bold text-gray-900">基本指標</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* PER */}
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">📈</div>
            <div className="text-lg font-bold text-blue-600">
              {formatNumber(analysisData.basicMetrics?.per)}
            </div>
            <div className="text-sm text-gray-600">PER</div>
            <div className="text-xs text-gray-500 mt-1">株価収益率</div>
          </div>

          {/* ROE */}
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">💰</div>
            <div className="text-lg font-bold text-green-600">
              {formatNumber(analysisData.basicMetrics?.roe, "%")}
            </div>
            <div className="text-sm text-gray-600">ROE</div>
            <div className="text-xs text-gray-500 mt-1">自己資本利益率</div>
          </div>

          {/* 配当利回り */}
          <div className="bg-yellow-50 rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">💎</div>
            <div className="text-lg font-bold text-yellow-600">
              {formatNumber(analysisData.basicMetrics?.dividendYield, "%")}
            </div>
            <div className="text-sm text-gray-600">配当利回り</div>
            <div className="text-xs text-gray-500 mt-1">年間配当金</div>
          </div>

          {/* 時価総額 */}
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">🏢</div>
            <div className="text-lg font-bold text-purple-600">
              {formatNumber(analysisData.stockInfo?.marketCap)}
            </div>
            <div className="text-sm text-gray-600">時価総額</div>
            <div className="text-xs text-gray-500 mt-1">企業の規模</div>
          </div>
        </div>
      </div>

      {/* 企業情報（簡素化） */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-3">🏢</span>
          <h2 className="text-xl font-bold text-gray-900">企業情報</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">基本情報</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">業界:</span>
                <span className="font-medium">{analysisData.companyOverview?.industry || "情報取得中"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">設立:</span>
                <span className="font-medium">{analysisData.companyOverview?.founded || "情報取得中"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">従業員数:</span>
                <span className="font-medium">
                  {analysisData.companyOverview?.employees?.toLocaleString() || "情報取得中"}人
                </span>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">事業内容</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              {analysisData.companyOverview?.description || "企業情報を分析中です..."}
            </p>
          </div>
        </div>
      </div>

      {/* 詳細情報（折りたたみ式） */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center">
            <span className="text-2xl mr-3">📋</span>
            <h2 className="text-xl font-bold text-gray-900">詳細情報</h2>
          </div>
          <span className={`text-gray-500 transition-transform ${showDetails ? "rotate-180" : ""}`}>
            ▼
          </span>
        </button>

        {showDetails && (
          <div className="mt-6 space-y-6">
            {/* リスク・機会 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-red-50 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 mb-3 flex items-center">
                  <span className="mr-2">⚠️</span>
                  主なリスク
                </h3>
                <ul className="space-y-2">
                  {analysisData.risks?.slice(0, 3).map((risk: string, index: number) => (
                    <li key={index} className="text-sm text-red-700 flex items-start">
                      <span className="text-red-500 mr-2 mt-1">•</span>
                      {risk}
                    </li>
                  )) || (
                    <li className="text-sm text-gray-500">リスク情報を分析中...</li>
                  )}
                </ul>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-3 flex items-center">
                  <span className="mr-2">💡</span>
                  投資機会
                </h3>
                <ul className="space-y-2">
                  {analysisData.opportunities?.slice(0, 3).map((opportunity: string, index: number) => (
                    <li key={index} className="text-sm text-green-700 flex items-start">
                      <span className="text-green-500 mr-2 mt-1">•</span>
                      {opportunity}
                    </li>
                  )) || (
                    <li className="text-sm text-gray-500">機会情報を分析中...</li>
                  )}
                </ul>
              </div>
            </div>

            {/* AIスコア */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <span className="mr-2">🤖</span>
                AI分析スコア
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {analysisData.aiScores?.overall || 0}
                  </div>
                  <div className="text-sm text-gray-600">総合スコア</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {analysisData.aiScores?.financial || 0}
                  </div>
                  <div className="text-sm text-gray-600">財務健全性</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {analysisData.aiScores?.growth || 0}
                  </div>
                  <div className="text-sm text-gray-600">成長性</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {analysisData.aiScores?.value || 0}
                  </div>
                  <div className="text-sm text-gray-600">バリュー</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* フッター */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>この分析はAIが生成したものであり、投資判断の参考情報としてご利用ください。</p>
        <p className="mt-1">投資は自己責任で行ってください。</p>
      </div>
    </div>
  );
}
