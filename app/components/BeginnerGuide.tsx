"use client";

import { useState } from "react";

// 初心者向けの説明コンポーネント
interface BeginnerGuideProps {
  onClose: () => void;
}

export function BeginnerGuide({ onClose }: BeginnerGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "株価とは？",
      content: "株価は、その会社の1株の値段です。会社の業績や将来性によって変動します。",
      icon: "💰",
      example: "例：トヨタの株価が2,500円なら、1株2,500円で取引されています"
    },
    {
      title: "PER（株価収益率）",
      content: "株価が1年間の利益の何倍かを示す指標です。低いほど割安とされています。",
      icon: "📊",
      example: "例：PER 15倍 = 株価が年間利益の15倍"
    },
    {
      title: "ROE（自己資本利益率）",
      content: "会社が自分のお金でどれだけ利益を上げているかを示す指標です。高いほど効率的です。",
      icon: "🎯",
      example: "例：ROE 15% = 自己資本100円で15円の利益"
    },
    {
      title: "配当利回り",
      content: "株価に対する年間配当金の割合です。高いほど配当が多くもらえます。",
      icon: "💎",
      example: "例：配当利回り3% = 株価100円で年間3円の配当"
    },
    {
      title: "投資判断の見方",
      content: "AIが分析した投資判断は、買い・売り・様子見の3つに分かれています。",
      icon: "🤖",
      example: "買い：投資を検討 / 売り：注意が必要 / 様子見：継続観察"
    }
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">初心者ガイド</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* 進捗バー */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>ステップ {currentStep + 1} / {steps.length}</span>
              <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* コンテンツ */}
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">{steps[currentStep].icon}</div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {steps[currentStep].title}
            </h3>
            <p className="text-gray-700 mb-4 leading-relaxed">
              {steps[currentStep].content}
            </p>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium">
                {steps[currentStep].example}
              </p>
            </div>
          </div>

          {/* ナビゲーション */}
          <div className="flex justify-between">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className={`px-4 py-2 rounded-lg ${
                currentStep === 0
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              前へ
            </button>
            
            {currentStep === steps.length - 1 ? (
              <button
                onClick={onClose}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                完了
              </button>
            ) : (
              <button
                onClick={nextStep}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                次へ
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ヘルプボタンコンポーネント
interface HelpButtonProps {
  onClick: () => void;
}

export function HelpButton({ onClick }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors z-40"
      title="初心者ガイド"
    >
      <span className="text-xl">❓</span>
    </button>
  );
}

// 用語集コンポーネント
interface GlossaryProps {
  onClose: () => void;
}

export function Glossary({ onClose }: GlossaryProps) {
  const terms = [
    {
      term: "株価",
      definition: "その会社の1株の値段。市場で取引される価格。",
      example: "トヨタの株価：2,500円"
    },
    {
      term: "PER",
      definition: "株価収益率。株価が1年間の利益の何倍かを示す。",
      example: "PER 15倍 = 割安、PER 30倍 = 割高"
    },
    {
      term: "ROE",
      definition: "自己資本利益率。自分のお金でどれだけ利益を上げているか。",
      example: "ROE 15% = 効率的、ROE 5% = 非効率"
    },
    {
      term: "配当利回り",
      definition: "株価に対する年間配当金の割合。",
      example: "配当利回り3% = 年間3%の配当"
    },
    {
      term: "時価総額",
      definition: "会社全体の価値。株価 × 発行済み株式数。",
      example: "時価総額30兆円 = 大企業"
    },
    {
      term: "買い",
      definition: "投資を検討する価値があるという判断。",
      example: "AIが「買い」と判断 = 投資候補"
    },
    {
      term: "売り",
      definition: "注意が必要、または投資を避けるべきという判断。",
      example: "AIが「売り」と判断 = 注意が必要"
    },
    {
      term: "様子見",
      definition: "継続的に観察する必要があるという判断。",
      example: "AIが「様子見」と判断 = 継続観察"
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">用語集</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* 用語一覧 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {terms.map((term, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 mb-2">{term.term}</h3>
                <p className="text-sm text-gray-700 mb-2">{term.definition}</p>
                <div className="bg-blue-50 rounded p-2">
                  <p className="text-xs text-blue-800 font-medium">{term.example}</p>
                </div>
              </div>
            ))}
          </div>

          {/* フッター */}
          <div className="mt-6 text-center">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
