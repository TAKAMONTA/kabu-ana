"use client";

import { useState } from "react";

interface ReadableAnalysisSectionProps {
  title: string;
  content: string;
  icon?: string;
  defaultExpanded?: boolean;
}

export function ReadableAnalysisSection({
  title,
  content,
  icon = "📊",
  defaultExpanded = true,
}: ReadableAnalysisSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // コンテンツを構造化されたセクションに分割
  const parseContent = (text: string) => {
    const sections = [];
    const lines = text.split("\n");
    let currentSection = { title: "", content: "", type: "text" };

    for (const line of lines) {
      const trimmedLine = line.trim();

      // セクションタイトルの検出
      if (trimmedLine.match(/^【.*】$/)) {
        if (currentSection.title) {
          sections.push({ ...currentSection });
        }
        currentSection = {
          title: trimmedLine.replace(/【|】/g, ""),
          content: "",
          type: "section",
        };
      }
      // リストアイテムの検出
      else if (trimmedLine.match(/^[・•\-\*]\s/)) {
        if (currentSection.type !== "list") {
          if (currentSection.title) {
            sections.push({ ...currentSection });
          }
          currentSection = {
            title: currentSection.title || "リスト",
            content: "",
            type: "list",
          };
        }
        currentSection.content += trimmedLine + "\n";
      }
      // 通常のテキスト
      else if (trimmedLine) {
        if (currentSection.type === "list") {
          sections.push({ ...currentSection });
          currentSection = {
            title: "",
            content: "",
            type: "text",
          };
        }
        currentSection.content += trimmedLine + "\n";
      }
    }

    if (currentSection.title || currentSection.content) {
      sections.push(currentSection);
    }

    return sections;
  };

  const sections = parseContent(content);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex justify-between items-center w-full text-left p-6 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center">
          <span className="text-2xl mr-3">{icon}</span>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        </div>
        <span
          className={`text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>

      {isExpanded && (
        <div className="px-6 pb-6 border-t border-gray-100">
          <div className="pt-6 space-y-6">
            {sections.map((section, index) => (
              <div key={index} className="space-y-3">
                {section.title && (
                  <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
                    {section.title}
                  </h3>
                )}

                {section.type === "list" ? (
                  <ul className="space-y-2">
                    {section.content
                      .split("\n")
                      .filter(line => line.trim())
                      .map((item, itemIndex) => (
                        <li key={itemIndex} className="flex items-start">
                          <span className="text-blue-500 mr-2 mt-1">•</span>
                          <span className="text-gray-700 leading-relaxed">
                            {item.replace(/^[・•\-\*]\s/, "")}
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <div className="prose prose-sm max-w-none">
                    {section.content.split("\n").map(
                      (paragraph, pIndex) =>
                        paragraph.trim() && (
                          <p
                            key={pIndex}
                            className="text-gray-700 leading-relaxed mb-3"
                          >
                            {paragraph.trim()}
                          </p>
                        )
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 数値データを強調表示するコンポーネント
interface HighlightedDataProps {
  label: string;
  value: string | number;
  unit?: string;
  change?: number;
  color?: "green" | "red" | "blue" | "gray";
}

export function HighlightedData({
  label,
  value,
  unit = "",
  change,
  color = "blue",
}: HighlightedDataProps) {
  const getColorClasses = (color: string) => {
    switch (color) {
      case "green":
        return "text-green-600 bg-green-50 border-green-200";
      case "red":
        return "text-red-600 bg-red-50 border-red-200";
      case "gray":
        return "text-gray-600 bg-gray-50 border-gray-200";
      default:
        return "text-blue-600 bg-blue-50 border-blue-200";
    }
  };

  return (
    <div className={`p-3 rounded-lg border ${getColorClasses(color)}`}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{label}</span>
        {change !== undefined && (
          <span
            className={`text-xs ${change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-gray-600"}`}
          >
            {change > 0 ? "+" : ""}
            {change}%
          </span>
        )}
      </div>
      <div className="text-lg font-bold mt-1">
        {typeof value === "number" ? value.toLocaleString() : value}
        {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
      </div>
    </div>
  );
}

// キーポイントを強調表示するコンポーネント
interface KeyPointsProps {
  points: string[];
  title?: string;
}

export function KeyPoints({ points, title = "重要ポイント" }: KeyPointsProps) {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <h4 className="font-semibold text-yellow-800 mb-3 flex items-center">
        <span className="mr-2">💡</span>
        {title}
      </h4>
      <ul className="space-y-2">
        {points.map((point, index) => (
          <li key={index} className="flex items-start">
            <span className="text-yellow-600 mr-2 mt-1">✓</span>
            <span className="text-yellow-800 text-sm leading-relaxed">
              {point}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// リスク・機会を分けて表示するコンポーネント
interface RiskOpportunityProps {
  risks: string[];
  opportunities: string[];
}

export function RiskOpportunity({
  risks,
  opportunities,
}: RiskOpportunityProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h4 className="font-semibold text-red-800 mb-3 flex items-center">
          <span className="mr-2">⚠️</span>
          リスク要因
        </h4>
        <ul className="space-y-2">
          {risks.map((risk, index) => (
            <li key={index} className="flex items-start">
              <span className="text-red-500 mr-2 mt-1">•</span>
              <span className="text-red-700 text-sm leading-relaxed">
                {risk}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-semibold text-green-800 mb-3 flex items-center">
          <span className="mr-2">🚀</span>
          成長機会
        </h4>
        <ul className="space-y-2">
          {opportunities.map((opportunity, index) => (
            <li key={index} className="flex items-start">
              <span className="text-green-500 mr-2 mt-1">•</span>
              <span className="text-green-700 text-sm leading-relaxed">
                {opportunity}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
