'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class AnalysisErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Analysis Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <span className="text-yellow-600 mr-2">⚠️</span>
            <div>
              <h3 className="text-yellow-800 font-medium">データ取得中に問題が発生しました</h3>
              <p className="text-yellow-700 text-sm mt-1">
                一部の情報が表示されない可能性があります。しばらく待ってから再読み込みしてください。
              </p>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="mt-2 px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
              >
                再試行
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// 関数コンポーネント版
export function ErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <div className="flex items-center">
        <span className="text-red-600 mr-2">❌</span>
        <div>
          <h3 className="text-red-800 font-medium">分析エラーが発生しました</h3>
          <p className="text-red-700 text-sm mt-1">
            {error.message || '予期しないエラーが発生しました。'}
          </p>
          <button
            onClick={resetError}
            className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
          >
            再試行
          </button>
        </div>
      </div>
    </div>
  );
}

// データ読み込み中の表示
export function LoadingState({ message = "データを読み込み中..." }: { message?: string }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
        <span className="text-blue-800">{message}</span>
      </div>
    </div>
  );
}

// データが空の場合の表示
export function EmptyState({ message = "データが見つかりませんでした" }: { message?: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-center">
        <span className="text-gray-600 mr-2">📊</span>
        <span className="text-gray-800">{message}</span>
      </div>
    </div>
  );
}
