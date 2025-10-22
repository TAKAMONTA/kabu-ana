'use client';

import { useState, ReactNode } from 'react';

interface AnalysisSectionProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  priority?: number;
  icon?: string;
  className?: string;
}

export function AnalysisSection({ 
  title, 
  children, 
  defaultExpanded = false, 
  priority = 1,
  icon = "📊",
  className = ""
}: AnalysisSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  const getPriorityColor = (priority: number) => {
    if (priority === 1) return 'border-l-blue-500 bg-blue-50';
    if (priority === 2) return 'border-l-green-500 bg-green-50';
    if (priority === 3) return 'border-l-yellow-500 bg-yellow-50';
    return 'border-l-gray-500 bg-gray-50';
  };

  return (
    <div className={`border rounded-lg mb-4 border-l-4 ${getPriorityColor(priority)} ${className}`}>
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex justify-between items-center w-full text-left p-4 hover:bg-opacity-80 transition-colors"
      >
        <div className="flex items-center">
          <span className="text-xl mr-3">{icon}</span>
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        </div>
        <span className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-200">
          <div className="pt-4">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

// 投資判断コンポーネント
interface InvestmentRecommendationProps {
  recommendation: 'strong-buy' | 'buy' | 'hold' | 'sell' | 'strong-sell';
  confidence: number;
  reasoning: string;
}

export function InvestmentRecommendation({ recommendation, confidence, reasoning }: InvestmentRecommendationProps) {
  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'strong-buy': return 'text-green-600 bg-green-50 border-green-200';
      case 'buy': return 'text-green-600 bg-green-50 border-green-200';
      case 'hold': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'sell': return 'text-red-600 bg-red-50 border-red-200';
      case 'strong-sell': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getRecommendationText = (rec: string) => {
    switch (rec) {
      case 'strong-buy': return '強力買い';
      case 'buy': return '買い';
      case 'hold': return '中立';
      case 'sell': return '売り';
      case 'strong-sell': return '強力売り';
      default: return '評価中';
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getRecommendationColor(recommendation)}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-lg">投資判断</h3>
          <p className="text-sm mt-1">{reasoning}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{confidence}%</div>
          <div className="text-sm">信頼度</div>
        </div>
      </div>
      <div className="flex items-center justify-center">
        <span className="text-3xl font-bold">{getRecommendationText(recommendation)}</span>
      </div>
    </div>
  );
}

// メトリクスカードコンポーネント
interface MetricCardProps {
  title: string;
  value: number | string;
  unit?: string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
}

export function MetricCard({ 
  title, 
  value, 
  unit = '', 
  change, 
  trend = 'neutral',
  description,
  color = 'blue'
}: MetricCardProps) {
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'green': return 'bg-green-50 border-green-200 text-green-800';
      case 'yellow': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'red': return 'bg-red-50 border-red-200 text-red-800';
      case 'gray': return 'bg-gray-50 border-gray-200 text-gray-800';
      default: return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      default: return '→';
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getColorClasses(color)}`}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium text-sm">{title}</h4>
        {change !== undefined && (
          <span className={`text-xs flex items-center ${
            change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'
          }`}>
            {getTrendIcon(trend)} {change > 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold mb-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
      </div>
      {description && (
        <p className="text-xs text-gray-600 mt-1">{description}</p>
      )}
    </div>
  );
}

// プログレスバーコンポーネント
interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red';
  showPercentage?: boolean;
}

export function ProgressBar({ 
  value, 
  max = 10, 
  label, 
  color = 'blue',
  showPercentage = true
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-500';
      case 'red': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="mb-3">
      {label && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {showPercentage && (
            <span className="text-sm text-gray-600">
              {value.toFixed(1)}/{max}
            </span>
          )}
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${getColorClasses(color)}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

// 比較モーダルコンポーネント
interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStock: any;
  comparisonStocks: any[];
}

export function ComparisonModal({ isOpen, onClose, currentStock, comparisonStocks }: ComparisonModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">銘柄比較</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 現在の銘柄 */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <h3 className="font-semibold text-blue-800">{currentStock.name}</h3>
            <div className="text-2xl font-bold text-blue-600 mt-2">
              {currentStock.price?.toLocaleString()}円
            </div>
            <div className="text-sm text-gray-600 mt-2">
              <div>PER: {currentStock.per || 'N/A'}</div>
              <div>ROE: {currentStock.roe || 'N/A'}%</div>
              <div>配当利回り: {currentStock.dividendYield || 'N/A'}%</div>
            </div>
          </div>
          
          {/* 比較対象の銘柄 */}
          {comparisonStocks.map((stock, index) => (
            <div key={index} className="border rounded-lg p-4">
              <h3 className="font-semibold">{stock.name}</h3>
              <div className="text-2xl font-bold text-gray-800 mt-2">
                {stock.price?.toLocaleString()}円
              </div>
              <div className="text-sm text-gray-600 mt-2">
                <div>PER: {stock.per || 'N/A'}</div>
                <div>ROE: {stock.roe || 'N/A'}%</div>
                <div>配当利回り: {stock.dividendYield || 'N/A'}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
