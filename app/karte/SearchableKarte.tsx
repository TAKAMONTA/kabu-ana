"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

interface StockResult {
  query: string;
  companyInfo: string;
  priceInfo: any;
  content?: string;
}

interface TrendingStock {
  code: string;
  name: string;
  reason: string;
}

export default function SearchableKarte() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [apiNote, setApiNote] = useState("");
  const [trendingStocks, setTrendingStocks] = useState<TrendingStock[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingStock, setAnalyzingStock] = useState<any>(null);
  const [analysisResults, setAnalysisResults] = useState<any>(null);

  // 人気株を取得
  useEffect(() => {
    const fetchTrendingStocks = async () => {
      try {
        const response = await fetch("/api/trending-stocks");
        const data = await response.json();
        if (data.success) {
          setTrendingStocks([...data.data.japan, ...data.data.us]);
        }
      } catch (error) {
        // エラーが発生した場合は人気株を表示しない
      }
    };
    fetchTrendingStocks();
  }, []);

  // 人気株をクリックした際の処理
  const handleTrendingStockClick = async (
    stockCode: string,
    stockName: string
  ) => {
    // 株式コードを検索クエリに設定
    setSearchQuery(stockCode);

    // 検索を実行
    setIsSearching(true);
    setErrorMessage("");
    setSearchResults([]);
    setApiNote("");

    try {
      const response = await fetch("/api/stock-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: stockCode }), // 株式コードを送信
      });

      const data = await response.json();

      if (data.success && data.results && data.results.length > 0) {
        setSearchResults(data.results);
        if (data.apiNote) {
          setApiNote(data.apiNote);
        }
      } else {
        setErrorMessage(data.error || "株式情報が見つかりませんでした");
      }
    } catch (error) {
      setErrorMessage(
        "検索処理でエラーが発生しました。しばらく時間をおいて再試行してください。"
      );
    } finally {
      setIsSearching(false);
    }
  };

  // 検索実行 - Perplexity APIを使用
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setErrorMessage("株式コードまたは会社名を入力してください");
      return;
    }

    setIsSearching(true);
    setErrorMessage("");
    setSearchResults([]);
    setApiNote("");

    try {
      // Perplexity APIで検索
      const response = await fetch("/api/stock-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          const errorData = await response.json();
          throw new Error(
            `Rate limit exceeded. ${
              errorData.resetIn || 60
            }秒後に再試行してください。`
          );
        }
        throw new Error("検索サービスが利用できません");
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        // Perplexityの結果を表示
        setSearchResults(
          data.results.map((result: any) => ({
            query: result.query,
            companyInfo: result.companyInfo,
            priceInfo: result.priceInfo,
            content: result.companyInfo || result.content,
          }))
        );
        setApiNote("📊 Perplexity AIで検索し、株価情報を取得しました");
        setTimeout(() => setApiNote(""), 5000);
      } else {
        setErrorMessage("検索結果が見つかりませんでした");
      }
    } catch (error) {
      console.error("Search error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "検索処理でエラーが発生しました"
      );
    } finally {
      setIsSearching(false);
    }
  };

  // 株式分析実行 - 包括的AI分析
  const analyzeStock = async (stock: any) => {
    setIsAnalyzing(true);
    setAnalyzingStock(stock);
    setErrorMessage("");

    try {
      const analysisSteps = [];
      let accumulatedData = {};

      // ステップ1: 基本情報取得
      const step1Response = await fetch("/api/analyze-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: stock.query,
          step: 1,
          previousData: {},
        }),
      });

      if (step1Response.ok) {
        const step1Data = await step1Response.json();
        accumulatedData = { ...accumulatedData, ...step1Data.data };
        analysisSteps.push({
          step: 1,
          data: step1Data.data,
          name: step1Data.stepName,
        });
      }

      // ステップ2: 最新ニュース取得
      const step2Response = await fetch("/api/analyze-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: stock.query,
          step: 2,
          previousData: accumulatedData,
        }),
      });

      if (step2Response.ok) {
        const step2Data = await step2Response.json();
        accumulatedData = { ...accumulatedData, ...step2Data.data };
        analysisSteps.push({
          step: 2,
          data: step2Data.data,
          name: step2Data.stepName,
        });
      }

      // ステップ3: 財務指標分析
      const step3Response = await fetch("/api/analyze-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: stock.query,
          step: 3,
          previousData: accumulatedData,
        }),
      });

      if (step3Response.ok) {
        const step3Data = await step3Response.json();
        accumulatedData = { ...accumulatedData, ...step3Data.data };
        analysisSteps.push({
          step: 3,
          data: step3Data.data,
          name: step3Data.stepName,
        });
      }

      // ステップ4: 競合分析
      const step4Response = await fetch("/api/analyze-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: stock.query,
          step: 4,
          previousData: accumulatedData,
        }),
      });

      if (step4Response.ok) {
        const step4Data = await step4Response.json();
        accumulatedData = { ...accumulatedData, ...step4Data.data };
        analysisSteps.push({
          step: 4,
          data: step4Data.data,
          name: step4Data.stepName,
        });
      }

      // ステップ5: AI総合分析
      const step5Response = await fetch("/api/analyze-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: stock.query,
          step: 5,
          previousData: accumulatedData,
        }),
      });

      if (step5Response.ok) {
        const step5Data = await step5Response.json();
        accumulatedData = { ...accumulatedData, ...step5Data.data };
        analysisSteps.push({
          step: 5,
          data: step5Data.data,
          name: step5Data.stepName,
        });
      }

      setAnalysisResults({
        steps: analysisSteps,
        finalData: accumulatedData,
      });
    } catch (error) {
      console.error("Analysis error:", error);
      setErrorMessage("分析処理でエラーが発生しました");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="karte-container">
      {/* 検索セクション */}
      <div className="search-section">
        <h2>株式検索</h2>
        <div className="search-input-group">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="株式コードまたは会社名を入力"
            className="search-input"
            onKeyPress={e => e.key === "Enter" && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="search-button"
          >
            {isSearching ? "検索中..." : "検索"}
          </button>
        </div>

        {errorMessage && <div className="error-message">{errorMessage}</div>}

        {apiNote && <div className="api-note">{apiNote}</div>}
      </div>

      {/* 人気株セクション */}
      {trendingStocks.length > 0 && (
        <div className="trending-section">
          <h3>人気株</h3>
          <div className="trending-grid">
            {trendingStocks.map((stock, index) => (
              <div
                key={index}
                className="trending-stock"
                onClick={() => handleTrendingStockClick(stock.code, stock.name)}
              >
                <div className="stock-code">{stock.code}</div>
                <div className="stock-name">{stock.name}</div>
                <div className="stock-reason">{stock.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 検索結果セクション */}
      {searchResults.length > 0 && (
        <div className="results-section">
          <h3>検索結果</h3>
          {searchResults.map((result, index) => (
            <div key={index} className="result-card">
              <div className="result-header">
                <h4>{result.query}</h4>
                <button
                  onClick={() => analyzeStock(result)}
                  disabled={isAnalyzing}
                  className="analyze-button"
                >
                  {isAnalyzing ? "分析中..." : "AI分析実行"}
                </button>
              </div>

              <div className="result-content">
                <div className="company-info">
                  <h5>会社情報</h5>
                  <p>{result.companyInfo}</p>
                </div>

                {result.priceInfo && (
                  <div className="price-info">
                    <h5>株価情報</h5>
                    <div className="price-details">
                      {result.priceInfo.currentPrice && (
                        <div className="price-item">
                          <span className="label">現在価格:</span>
                          <span className="value">
                            {result.priceInfo.currentPrice}
                          </span>
                        </div>
                      )}
                      {result.priceInfo.changePercent && (
                        <div className="price-item">
                          <span className="label">変化率:</span>
                          <span className="value">
                            {result.priceInfo.changePercent}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分析結果セクション */}
      {analysisResults && (
        <div className="analysis-section">
          <h3>AI分析結果</h3>
          <div className="analysis-steps">
            {analysisResults.steps.map((step: any, index: number) => (
              <div key={index} className="analysis-step">
                <h4>
                  ステップ {step.step}: {step.name}
                </h4>
                <div className="step-content">
                  <pre>{JSON.stringify(step.data, null, 2)}</pre>
                </div>
              </div>
            ))}
          </div>

          <div className="final-analysis">
            <h4>最終分析結果</h4>
            <div className="final-content">
              <pre>{JSON.stringify(analysisResults.finalData, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
