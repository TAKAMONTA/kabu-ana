"use client";

import { useState } from "react";

interface UltraSimpleAnalysisProps {
  analysisData: any;
  stockCode: string;
  companyName: string;
  market: string;
}

export function UltraSimpleAnalysis({
  analysisData,
  stockCode,
  companyName,
  market,
}: UltraSimpleAnalysisProps) {
  const [showMore, setShowMore] = useState(false);

  // 投資判断を超シンプルに
  const getSimpleAdvice = (recommendation: string) => {
    switch (recommendation?.toLowerCase()) {
      case "buy":
      case "strong_buy":
        return {
          text: "買い",
          color: "text-green-600",
          bg: "bg-green-100",
          emoji: "👍",
        };
      case "sell":
      case "strong_sell":
        return {
          text: "売り",
          color: "text-red-600",
          bg: "bg-red-100",
          emoji: "👎",
        };
      case "hold":
      default:
        return {
          text: "様子見",
          color: "text-yellow-600",
          bg: "bg-yellow-100",
          emoji: "👀",
        };
    }
  };

  // 数値を超シンプルに表示
  const formatSimpleNumber = (value: number, unit: string = "") => {
    if (!value || value === 0) return "わからない";
    if (unit === "%") return `${value.toFixed(1)}%`;
    if (unit === "円") return `${value.toLocaleString()}円`;
    return value.toLocaleString();
  };

  // 株価の変動を超シンプルに
  const getSimplePriceChange = (change: number) => {
    if (!change) return null;
    const isPositive = change > 0;
    return {
      text: `${isPositive ? "+" : ""}${change.toFixed(1)}%`,
      color: isPositive ? "text-green-600" : "text-red-600",
      emoji: isPositive ? "📈" : "📉",
    };
  };

  const advice = getSimpleAdvice(analysisData.aiScores?.recommendation);
  const priceChange = getSimplePriceChange(
    analysisData.stockInfo?.changePercent
  );

  // 基本指標を直接抽出（改善版）
  const getBasicMetrics = () => {
    const data = analysisData;

    // 複数の場所から数値を探す（より包括的）
    const findNumber = (paths: string[]) => {
      for (const path of paths) {
        const value = path.split(".").reduce((obj, key) => obj?.[key], data);
        if (value && value > 0) {
          console.log(`Found ${path}:`, value);
          return value;
        }
      }
      return 0;
    };

    // デバッグ用：全データをログ出力
    console.log("Full analysis data:", data);

    const metrics = {
      price: findNumber([
        "stockInfo.price",
        "currentPrice",
        "price",
        "stockData.currentPrice",
      ]),
      per: findNumber([
        "basicMetrics.per",
        "pe",
        "PER",
        "stockData.pe",
        "stockData.PER",
      ]),
      roe: findNumber([
        "basicMetrics.roe",
        "roe",
        "ROE",
        "financialAnalysis.roe",
        "stockData.roe",
      ]),
      dividend: findNumber([
        "basicMetrics.dividendYield",
        "dividendYield",
        "stockData.dividendYield",
        "stockData.dividend",
      ]),
      marketCap: findNumber([
        "stockInfo.marketCap",
        "marketCap",
        "stockData.marketCap",
      ]),
    };

    console.log("Extracted metrics:", metrics);
    return metrics;
  };

  const metrics = getBasicMetrics();

  return (
    <div className="max-w-4xl mx-auto p-4 bg-gray-50 min-h-screen">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {companyName}
          </h1>
          <p className="text-gray-600 mb-4">
            {stockCode} • {market === "JP" ? "日本株" : "米国株"}
          </p>

          {/* 株価 */}
          <div className="text-center mb-4">
            <div className="text-3xl font-bold text-gray-900">
              {formatSimpleNumber(metrics.price, "円")}
            </div>
            {priceChange && (
              <div
                className={`flex items-center justify-center mt-2 ${priceChange.color}`}
              >
                <span className="mr-2 text-xl">{priceChange.emoji}</span>
                <span className="text-lg font-medium">{priceChange.text}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 投資判断（最重要） */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-4">AIの判断</h2>

          <div className={`${advice.bg} rounded-lg p-6 mb-4`}>
            <div className="text-4xl mb-2">{advice.emoji}</div>
            <div className={`text-3xl font-bold ${advice.color} mb-2`}>
              {advice.text}
            </div>
            <p className="text-gray-600">AIが分析した結果です</p>
          </div>

          {/* 簡潔な理由 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">理由</h3>
            <p className="text-gray-700 text-sm leading-relaxed">
              {analysisData.aiSummary || "分析中..."}
            </p>
          </div>
        </div>
      </div>

      {/* 基本指標（超シンプル） */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">
          基本情報
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {/* PER */}
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">📊</div>
            <div className="text-lg font-bold text-blue-600">
              {formatSimpleNumber(metrics.per)}
            </div>
            <div className="text-sm text-gray-600">PER</div>
            <div className="text-xs text-gray-500 mt-1">株価の割安度</div>
          </div>

          {/* ROE */}
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">💰</div>
            <div className="text-lg font-bold text-green-600">
              {formatSimpleNumber(metrics.roe, "%")}
            </div>
            <div className="text-sm text-gray-600">ROE</div>
            <div className="text-xs text-gray-500 mt-1">利益の効率</div>
          </div>

          {/* 配当利回り */}
          <div className="bg-yellow-50 rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">💎</div>
            <div className="text-lg font-bold text-yellow-600">
              {formatSimpleNumber(metrics.dividend, "%")}
            </div>
            <div className="text-sm text-gray-600">配当利回り</div>
            <div className="text-xs text-gray-500 mt-1">配当の割合</div>
          </div>

          {/* 時価総額 */}
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">🏢</div>
            <div className="text-lg font-bold text-purple-600">
              {formatSimpleNumber(metrics.marketCap)}
            </div>
            <div className="text-sm text-gray-600">時価総額</div>
            <div className="text-xs text-gray-500 mt-1">会社の規模</div>
          </div>
        </div>
      </div>

      {/* 企業情報（超シンプル） */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">
          会社について
        </h2>

        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">業界</span>
            <span className="font-medium">
              {analysisData.companyOverview?.industry || "わからない"}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">設立</span>
            <span className="font-medium">
              {analysisData.companyOverview?.founded || "わからない"}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">従業員数</span>
            <span className="font-medium">
              {analysisData.companyOverview?.employees?.toLocaleString() ||
                "わからない"}
              人
            </span>
          </div>
        </div>

        {/* 事業内容 */}
        <div className="mt-4">
          <h3 className="font-semibold text-gray-900 mb-2">事業内容</h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            {analysisData.companyOverview?.description ||
              "会社の情報を調べています..."}
          </p>
        </div>
      </div>

      {/* 詳細情報（折りたたみ式） */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <button
          onClick={() => setShowMore(!showMore)}
          className="flex items-center justify-between w-full text-left"
        >
          <h2 className="text-xl font-bold text-gray-900">もっと詳しく</h2>
          <span
            className={`text-gray-500 transition-transform ${showMore ? "rotate-180" : ""}`}
          >
            ▼
          </span>
        </button>

        {showMore && (
          <div className="mt-6 space-y-4">
            {/* リスク・機会 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-red-50 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 mb-3 flex items-center">
                  <span className="mr-2">⚠️</span>
                  注意点
                </h3>
                <ul className="space-y-2">
                  {analysisData.risks
                    ?.slice(0, 2)
                    .map((risk: string, index: number) => (
                      <li
                        key={index}
                        className="text-sm text-red-700 flex items-start"
                      >
                        <span className="text-red-500 mr-2 mt-1">•</span>
                        {risk}
                      </li>
                    )) || (
                    <li className="text-sm text-gray-500">調べています...</li>
                  )}
                </ul>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-3 flex items-center">
                  <span className="mr-2">💡</span>
                  良い点
                </h3>
                <ul className="space-y-2">
                  {analysisData.opportunities
                    ?.slice(0, 2)
                    .map((opportunity: string, index: number) => (
                      <li
                        key={index}
                        className="text-sm text-green-700 flex items-start"
                      >
                        <span className="text-green-500 mr-2 mt-1">•</span>
                        {opportunity}
                      </li>
                    )) || (
                    <li className="text-sm text-gray-500">調べています...</li>
                  )}
                </ul>
              </div>
            </div>

            {/* AIスコア */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <span className="mr-2">🤖</span>
                AIスコア
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {analysisData.aiScores?.overall || 0}
                  </div>
                  <div className="text-sm text-gray-600">総合</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {analysisData.aiScores?.financial || 0}
                  </div>
                  <div className="text-sm text-gray-600">財務</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {analysisData.aiScores?.growth || 0}
                  </div>
                  <div className="text-sm text-gray-600">成長</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {analysisData.aiScores?.value || 0}
                  </div>
                  <div className="text-sm text-gray-600">価値</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* フッター */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>この分析はAIが作ったもので、参考程度にしてください。</p>
        <p className="mt-1">投資は自分で判断してください。</p>
      </div>
    </div>
  );
}
