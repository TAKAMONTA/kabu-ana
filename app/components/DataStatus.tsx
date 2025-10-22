'use client';

import { useState, useEffect } from 'react';

interface DataStatusProps {
  lastUpdated: string;
  dataSource: string;
  isRealTime?: boolean;
}

export function DataStatus({ lastUpdated, dataSource, isRealTime = false }: DataStatusProps) {
  const [timeAgo, setTimeAgo] = useState('');
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateTimeAgo = () => {
      const now = new Date();
      const updated = new Date(lastUpdated);
      const diff = now.getTime() - updated.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (minutes < 1) {
        setTimeAgo('1分以内');
      } else if (minutes < 60) {
        setTimeAgo(`${minutes}分前`);
      } else if (hours < 24) {
        setTimeAgo(`${hours}時間前`);
      } else {
        setTimeAgo(`${days}日前`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 60000); // 1分ごとに更新

    return () => clearInterval(interval);
  }, [lastUpdated]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500';
    if (isRealTime) return 'bg-green-500';
    return 'bg-blue-500';
  };

  const getStatusText = () => {
    if (!isOnline) return 'オフライン';
    if (isRealTime) return 'リアルタイム';
    return '更新済み';
  };

  return (
    <div className="flex items-center text-sm text-gray-500 space-x-2">
      <div className="flex items-center">
        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${getStatusColor()}`}></span>
        <span>{getStatusText()}</span>
      </div>
      <span>•</span>
      <span>{timeAgo}更新</span>
      <span>•</span>
      <span>{dataSource}</span>
    </div>
  );
}

// データ品質インジケーター
interface DataQualityProps {
  confidence: number;
  completeness: number;
  recency: number;
}

export function DataQualityIndicator({ confidence, completeness, recency }: DataQualityProps) {
  const getQualityColor = (value: number) => {
    if (value >= 80) return 'text-green-600';
    if (value >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityText = (value: number) => {
    if (value >= 80) return '高品質';
    if (value >= 60) return '中品質';
    return '低品質';
  };

  return (
    <div className="bg-gray-50 rounded-lg p-3 mb-4">
      <h4 className="text-sm font-medium text-gray-700 mb-2">データ品質</h4>
      <div className="grid grid-cols-3 gap-4 text-xs">
        <div>
          <div className="flex justify-between items-center mb-1">
            <span>信頼度</span>
            <span className={getQualityColor(confidence)}>{confidence}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div 
              className="bg-blue-600 h-1 rounded-full" 
              style={{ width: `${confidence}%` }}
            ></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span>完全性</span>
            <span className={getQualityColor(completeness)}>{completeness}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div 
              className="bg-green-600 h-1 rounded-full" 
              style={{ width: `${completeness}%` }}
            ></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span>鮮度</span>
            <span className={getQualityColor(recency)}>{recency}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div 
              className="bg-orange-600 h-1 rounded-full" 
              style={{ width: `${recency}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// エラー通知コンポーネント
interface ErrorNotificationProps {
  errors: string[];
  onDismiss: (index: number) => void;
}

export function ErrorNotification({ errors, onDismiss }: ErrorNotificationProps) {
  if (errors.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {errors.map((error, index) => (
        <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-red-600 mr-2">⚠️</span>
              <span className="text-red-800 text-sm">{error}</span>
            </div>
            <button
              onClick={() => onDismiss(index)}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
