'use client';

import { useState } from 'react';
import AIKarteDisplay from '../components/AIKarteDisplay';

// 銘柄データの型定義
interface Stock {
  code: string;
  name: string;
  market?: string;
}

// サンプルデータを削除 - Perplexity APIのみ使用

export default function SearchableKarte() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Stock[]>([]);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showKarte, setShowKarte] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [apiNote, setApiNote] = useState('');
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // 検索処理（Perplexity APIを使用）
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setErrorMessage('銘柄コードまたは企業名を入力してください');
      return;
    }

    setIsSearching(true);
    setErrorMessage('');
    setSearchResults([]);
    setApiNote('');
    
    try {
      // Perplexity APIで検索
      const response = await fetch('/api/stock-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          const errorData = await response.json();
          throw new Error(`リクエスト制限に達しました。${errorData.resetIn || 60}秒後に再試行してください。`);
        }
        throw new Error('検索サービスに接続できませんでした');
      }

      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        // Perplexityの結果を表示
        setSearchResults(data.results.map((result: any) => ({
          query: result.query,
          companyInfo: result.companyInfo,
          priceInfo: result.priceInfo,
          content: result.companyInfo || result.content
        })));
        setApiNote('🔍 Perplexity AIで検索し、株価情報を取得しました');
        setTimeout(() => setApiNote(''), 5000);
      } else {
        setErrorMessage('検索結果がありませんでした');
      }
    } catch (error) {
      console.error('Search error:', error);
      setErrorMessage(error instanceof Error ? error.message : '検索中にエラーが発生しました');
    } finally {
      setIsSearching(false);
    }
  };

  // 銘柄選択処理（削除 - 使用しない）

  // AIカルテ生成処理（3段階のAPI呼び出し）
  const generateKarte = async () => {
    if (!selectedStock) {
      alert('銘柄を選択してください');
      return;
    }
    
    setIsGenerating(true);
    setGenerationStep('🤖 ChatGPTに企業情報を確認中...');
    setApiNote('OpenAI APIを使用してChatGPTに分析を依頼しています');
    setErrorMessage('');
    
    try {
      // ステップ1: 企業を特定
      setGenerationStep('🤖 ChatGPTに企業情報を聞いています... (1/3)');
      const step1Response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockCode: selectedStock.code,
          market: selectedStock.market || 'JP',
          step: 1
        })
      });
      
      if (!step1Response.ok) {
        const errorData = await step1Response.json().catch(() => ({}));
        if (step1Response.status === 429) {
          throw new Error(`リクエスト制限: ${errorData.message || '少し待ってから再試行してください'}`);
        }
        throw new Error(errorData.error || '企業情報の取得に失敗しました');
      }
      
      const step1Data = await step1Response.json();
      
      // ステップ2: 株価を取得
      setGenerationStep('📊 ChatGPTに株価動向を分析してもらっています... (2/3)');
      const step2Response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockCode: selectedStock.code,
          market: selectedStock.market || 'JP',
          step: 2,
          previousData: { companyName: step1Data.companyName || selectedStock.name }
        })
      });
      
      if (!step2Response.ok) {
        throw new Error('株価情報の取得に失敗しました');
      }
      
      const step2Data = await step2Response.json();
      
      // ステップ3: 詳細分析
      setGenerationStep('🌟 ChatGPTが詳細な投資分析を作成中... (3/3)');
      const step3Response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockCode: selectedStock.code,
          market: selectedStock.market || 'JP',
          step: 3,
          previousData: {
            companyName: step1Data.companyName || selectedStock.name,
            currentPrice: step2Data.currentPrice || 0
          }
        })
      });
      
      if (!step3Response.ok) {
        throw new Error('AI分析の実行に失敗しました');
      }
      
      const analysisResult = await step3Response.json();
      
      // 分析結果を設定
      setAnalysisData(analysisResult);
      setShowKarte(true);
      
    } catch (error) {
      console.error('カルテ生成エラー:', error);
      const errorMsg = error instanceof Error ? error.message : 'AIカルテの生成に失敗しました';
      setErrorMessage(errorMsg + '。もう一度お試しください。');
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
      setApiNote('');
    }
  };

  // カルテを閉じる処理
  const closeKarte = () => {
    setShowKarte(false);
    setAnalysisData(null);
  };

  return (
    <>
      <div className="search-section">
        <h2>銘柄検索</h2>
        <div className="search-box">
          <input 
            type="text" 
            placeholder="銘柄コードまたは企業名を入力..." 
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
          />
          <button 
            className="search-button" 
            onClick={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? '検索中...' : '検索'}
          </button>
        </div>

        {/* エラーメッセージ */}
        {errorMessage && (
          <div className="error-message" style={{
            marginTop: '10px',
            padding: '12px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            borderRadius: '8px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'start',
            gap: '8px'
          }}>
            <span style={{ fontSize: '16px', marginTop: '2px' }}>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 検索結果 */}
        {searchResults.length > 0 && (
          <div className="search-results">
            <h3>Perplexity AI検索結果</h3>
            <div className="results-list">
              {searchResults.map((stock: any, index: number) => (
                <div 
                  key={index} 
                  className="result-item"
                  style={{
                    padding: '20px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    marginBottom: '15px',
                    cursor: 'default',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  {/* 銘柄名 */}
                  <div style={{ 
                    fontWeight: 'bold', 
                    fontSize: '18px',
                    marginBottom: '15px',
                    color: '#111827'
                  }}>
                    🔍 {stock.query}
                  </div>
                  
                  {/* 株価情報 */}
                  {stock.priceInfo && (
                    <div style={{
                      backgroundColor: '#f3f4f6',
                      padding: '15px',
                      borderRadius: '8px',
                      marginBottom: '15px'
                    }}>
                      <h4 style={{ 
                        fontSize: '16px', 
                        fontWeight: 'bold',
                        marginBottom: '10px',
                        color: '#374151'
                      }}>
                        📊 株価情報
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                        {stock.priceInfo.currentPrice && (
                          <div>
                            <span style={{ color: '#6b7280', fontSize: '12px' }}>現在価格</span>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>
                              {stock.priceInfo.currentPrice}
                            </div>
                          </div>
                        )}
                        {stock.priceInfo.change && (
                          <div>
                            <span style={{ color: '#6b7280', fontSize: '12px' }}>前日比</span>
                            <div style={{ 
                              fontSize: '16px', 
                              fontWeight: 'bold',
                              color: stock.priceInfo.change.startsWith('-') ? '#dc2626' : '#16a34a'
                            }}>
                              {stock.priceInfo.change}
                              {stock.priceInfo.changePercent && ` (${stock.priceInfo.changePercent}%)`}
                            </div>
                          </div>
                        )}
                        {stock.priceInfo.volume && (
                          <div style={{ gridColumn: 'span 2' }}>
                            <span style={{ color: '#6b7280', fontSize: '12px' }}>出来高</span>
                            <div style={{ fontSize: '14px', color: '#374151' }}>
                              {stock.priceInfo.volume}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* 企業情報 */}
                  <div style={{
                    backgroundColor: '#f9fafb',
                    padding: '15px',
                    borderRadius: '8px'
                  }}>
                    <h4 style={{ 
                      fontSize: '14px', 
                      fontWeight: 'bold',
                      marginBottom: '10px',
                      color: '#374151'
                    }}>
                      🏢 企業情報
                    </h4>
                    <div style={{ 
                      whiteSpace: 'pre-wrap',
                      fontSize: '13px',
                      lineHeight: '1.6',
                      color: '#4b5563',
                      maxHeight: '200px',
                      overflow: 'auto'
                    }}>
                      {stock.companyInfo || stock.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 選択された銘柄 */}
        {selectedStock && (
          <div className="selected-stock">
            <h3>選択中の銘柄</h3>
            <div className={`selected-stock-card ${selectedStock.market === 'US' ? 'us-stock' : ''}`}>
              <div className="selected-info">
                <span className="stock-code">{selectedStock.code}</span>
                <span className="stock-name">{selectedStock.name}</span>
              </div>
              <button className="generate-button" onClick={generateKarte} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <span className="loading-spinner"></span>
                    {generationStep || '生成中...'}
                  </>
                ) : (
                  '🤖 ChatGPTに分析を依頼'
                )}
              </button>
            </div>
            {apiNote && (
              <div style={{
                marginTop: '10px',
                padding: '12px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#1e40af',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                animation: 'fadeIn 0.3s ease-in'
              }}>
                {apiNote}
              </div>
            )}
          </div>
        )}
      </div>

      {/* サンプル銘柄を削除 */}

      {/* AIカルテ表示 */}
      {showKarte && analysisData && (
        <AIKarteDisplay 
          analysisData={analysisData}
          onClose={closeKarte}
        />
      )}
    </>
  );
}