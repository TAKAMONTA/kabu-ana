"use client";

import React from "react";
import type { AIAnalysisData } from "@/app/types/ai";

interface PerplexityBasedAnalysisProps {
  analysisData: AIAnalysisData;
  onClose: () => void;
}

// 価格フォーマット関数
function formatPrice(price: number | undefined, currency: string): string {
  if (price === undefined || price === null) return "N/A";
  if (currency === "JPY") {
    return `${price.toLocaleString()}円`;
  } else {
    return `$${price.toLocaleString()}`;
  }
}

// 変動フォーマット関数
function formatChange(
  change: number | undefined,
  changePercent: number | undefined
): string {
  if (change === undefined || changePercent === undefined) return "N/A";
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`;
}

// 変動色取得関数
function getChangeColor(change: number | undefined): string {
  if (change === undefined) return "text-gray-500";
  return change >= 0 ? "text-green-600" : "text-red-600";
}

export default function PerplexityBasedAnalysis({
  analysisData,
  onClose,
}: PerplexityBasedAnalysisProps) {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {analysisData.stockInfo.name}
            </h1>
            <p className="text-lg text-gray-600">
              {analysisData.stockInfo.code} ({analysisData.stockInfo.market})
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-800">
              {formatPrice(
                analysisData.stockInfo.currentPrice,
                analysisData.stockInfo.currency
              )}
            </div>
            <div
              className={`text-lg font-semibold ${getChangeColor(analysisData.stockInfo.change)}`}
            >
              {formatChange(
                analysisData.stockInfo.change,
                analysisData.stockInfo.changePercent
              )}
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          最終更新:{" "}
          {new Date(analysisData.stockInfo.lastUpdated).toLocaleString("ja-JP")}
        </div>
      </div>

      {/* AIスコア表示 - 円形プログレスバー */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-xl font-bold mb-6 text-gray-800">AI分析スコア</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {/* 投資スコア */}
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-3">
              <svg
                className="w-20 h-20 transform -rotate-90"
                viewBox="0 0 36 36"
              >
                <path
                  className="text-gray-200"
                  strokeWidth="3"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-blue-500"
                  strokeWidth="3"
                  strokeDasharray={`${analysisData.aiScores.investmentScore}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-800">
                  {analysisData.aiScores.investmentScore}
                </span>
              </div>
            </div>
            <h4 className="text-sm font-semibold text-gray-700">投資スコア</h4>
          </div>

          {/* 成長予測 */}
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-3">
              <svg
                className="w-20 h-20 transform -rotate-90"
                viewBox="0 0 36 36"
              >
                <path
                  className="text-gray-200"
                  strokeWidth="3"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-green-500"
                  strokeWidth="3"
                  strokeDasharray={`${analysisData.aiScores.growthPrediction}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-800">
                  {analysisData.aiScores.growthPrediction}
                </span>
              </div>
            </div>
            <h4 className="text-sm font-semibold text-gray-700">成長予測</h4>
          </div>

          {/* リスク評価 */}
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-3">
              <svg
                className="w-20 h-20 transform -rotate-90"
                viewBox="0 0 36 36"
              >
                <path
                  className="text-gray-200"
                  strokeWidth="3"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-orange-500"
                  strokeWidth="3"
                  strokeDasharray={`${analysisData.aiScores.riskAssessment}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-800">
                  {analysisData.aiScores.riskAssessment}
                </span>
              </div>
            </div>
            <h4 className="text-sm font-semibold text-gray-700">リスク評価</h4>
          </div>

          {/* AI信頼度 */}
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-3">
              <svg
                className="w-20 h-20 transform -rotate-90"
                viewBox="0 0 36 36"
              >
                <path
                  className="text-gray-200"
                  strokeWidth="3"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-purple-500"
                  strokeWidth="3"
                  strokeDasharray={`${analysisData.aiScores.aiConfidence}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-800">
                  {analysisData.aiScores.aiConfidence}
                </span>
              </div>
            </div>
            <h4 className="text-sm font-semibold text-gray-700">AI信頼度</h4>
          </div>
        </div>
      </div>

      {/* 企業概要 */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-xl font-bold mb-6 text-gray-800">企業概要</h3>
        <div className="space-y-6">
          {/* 企業名 */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="text-lg font-semibold text-gray-800 mb-2">企業名</h4>
            <p className="text-gray-700">{analysisData.stockInfo.name}</p>
          </div>

          {/* 事業内容 */}
          <div className="border-l-4 border-green-500 pl-4">
            <h4 className="text-lg font-semibold text-gray-800 mb-2">
              事業内容
            </h4>
            <p className="text-gray-700 leading-relaxed">
              世界最大級の自動車メーカーとして、幅広い自動車製品の設計・製造・販売を行っています。
              ハイブリッド車や電気自動車（EV）の開発にも積極的に取り組んでおり、環境に配慮した
              次世代モビリティの提供を目指しています。
            </p>
          </div>

          {/* 財務ハイライト */}
          <div className="border-l-4 border-purple-500 pl-4">
            <h4 className="text-lg font-semibold text-gray-800 mb-2">
              財務ハイライト
            </h4>
            <div className="space-y-2">
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                <span className="text-gray-700">
                  2024年3月期連結純利益: 過去最高の約3兆9,500億円を見込み
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>
                <span className="text-gray-700">
                  2023年年間生産台数: 過去最高を更新
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-purple-400 rounded-full mr-3"></span>
                <span className="text-gray-700">
                  グループ構成: 連結子会社約507社、主要子会社57社
                </span>
              </div>
            </div>
          </div>

          {/* 競争優位性 */}
          <div className="border-l-4 border-orange-500 pl-4">
            <h4 className="text-lg font-semibold text-gray-800 mb-2">
              競争優位性
            </h4>
            <div className="space-y-2">
              <div className="flex items-center">
                <span className="w-2 h-2 bg-orange-400 rounded-full mr-3"></span>
                <span className="text-gray-700">
                  テスラを上回る規模の生産能力
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-orange-400 rounded-full mr-3"></span>
                <span className="text-gray-700">
                  ESG・サステナビリティへの積極的取り組み
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-orange-400 rounded-full mr-3"></span>
                <span className="text-gray-700">
                  国際統合報告フレームワークに基づく透明性の高い情報開示
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI分析結果 - 構造化 */}
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-gray-800">AI分析結果</h3>

        {/* 分析セクションをカード形式で表示 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 株価状況と変動要因 */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h4 className="text-lg font-semibold mb-4 text-blue-600 flex items-center">
              <span className="mr-2">📈</span>
              株価状況と変動要因
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">現在株価:</span>
                <span className="font-semibold">
                  {formatPrice(
                    analysisData.stockInfo.currentPrice,
                    analysisData.stockInfo.currency
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">前日比:</span>
                <span
                  className={`font-semibold ${getChangeColor(analysisData.stockInfo.change)}`}
                >
                  {formatChange(
                    analysisData.stockInfo.change,
                    analysisData.stockInfo.changePercent
                  )}
                </span>
              </div>
              <div className="text-sm text-gray-600 mt-4">
                株価は市場の需給バランス、業績予想、経済指標、競合状況などに影響を受けます。
              </div>
            </div>
          </div>

          {/* 事業内容と競争優位性 */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h4 className="text-lg font-semibold mb-4 text-green-600 flex items-center">
              <span className="mr-2">🏢</span>
              事業内容と競争優位性
            </h4>
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                自動車の設計・製造・販売を主軸とし、ハイブリッド車やEVの開発にも注力。
                トヨタ生産方式による効率的な生産体制と強力なブランド力が競争優位性の源泉です。
              </div>
            </div>
          </div>

          {/* 財務状況と成長性 */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h4 className="text-lg font-semibold mb-4 text-purple-600 flex items-center">
              <span className="mr-2">💰</span>
              財務状況と成長性
            </h4>
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                過去最高の純利益予想により財務基盤は強固。生産台数の増加とEV市場への
                積極投資が将来の成長を支える要因となっています。
              </div>
            </div>
          </div>

          {/* リスク要因 */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h4 className="text-lg font-semibold mb-4 text-red-600 flex items-center">
              <span className="mr-2">⚠️</span>
              リスク要因
            </h4>
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                EV市場での競争激化、サプライチェーンの問題、環境規制の変化などが
                主なリスク要因として挙げられます。
              </div>
            </div>
          </div>

          {/* 投資判断 */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h4 className="text-lg font-semibold mb-4 text-yellow-600 flex items-center">
              <span className="mr-2">🎯</span>
              投資判断
            </h4>
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                強固な財務基盤と競争優位性を考慮すると、長期的な成長が期待できる
                投資対象として評価されます。
              </div>
            </div>
          </div>

          {/* 将来の株価予想 */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h4 className="text-lg font-semibold mb-4 text-indigo-600 flex items-center">
              <span className="mr-2">🔮</span>
              将来の株価予想
            </h4>
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                業績予想と市場環境を考慮すると、中長期的には上昇基調を維持する
                可能性が高いと予想されます。
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 基本指標 */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-xl font-bold mb-4 text-gray-800">基本指標</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-800">
              {analysisData.basicMetrics.marketCap
                ? `${(analysisData.basicMetrics.marketCap / 1000000000000).toFixed(1)}兆円`
                : "N/A"}
            </div>
            <div className="text-sm text-gray-600">時価総額</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-800">
              {analysisData.basicMetrics.per
                ? analysisData.basicMetrics.per.toFixed(1)
                : "N/A"}
            </div>
            <div className="text-sm text-gray-600">PER</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-800">
              {analysisData.basicMetrics.pbr
                ? analysisData.basicMetrics.pbr.toFixed(1)
                : "N/A"}
            </div>
            <div className="text-sm text-gray-600">PBR</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-800">
              {analysisData.basicMetrics.dividendYield
                ? `${analysisData.basicMetrics.dividendYield.toFixed(2)}%`
                : "N/A"}
            </div>
            <div className="text-sm text-gray-600">配当利回り</div>
          </div>
        </div>
      </div>

      {/* アクションボタン - レスポンシブ */}
      <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
        <button
          onClick={onClose}
          className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors w-full sm:w-auto"
        >
          閉じる
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors w-full sm:w-auto"
        >
          再分析
        </button>
      </div>
    </div>
  );
}
