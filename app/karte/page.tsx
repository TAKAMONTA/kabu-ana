"use client";

import SearchableKarte from "./SearchableKarte";
import ProtectedRoute from "../components/auth/ProtectedRoute";

export default function KartePage() {
  return (
    <ProtectedRoute>
      <main>
        <header className="karte-header">
          <div className="header-icons">
            <span className="icon blue">📊</span>
            <span className="icon green">📈</span>
            <span className="icon pink">📉</span>
          </div>
          <h1>株価AI分析</h1>
          <p className="subtitle">AIを活用した株価分析のためのツール</p>
        </header>

        {/* 4コマ漫画風の使い方説明 */}
        <div className="manga-guide">
          <h2>📖 カードの使い方</h2>
          <div className="manga-panels">
            <div className="manga-panel">
              <div className="panel-number">1</div>
              <div className="panel-icon">🔍</div>
              <div className="panel-content">
                <h3>株価を検索</h3>
                <p>
                  下から会社名や
                  <br />
                  株コードを入力
                </p>
                <div className="panel-speech">「トヨタ」とか入力するの？</div>
              </div>
            </div>

            <div className="manga-panel">
              <div className="panel-number">2</div>
              <div className="panel-icon">🤖</div>
              <div className="panel-content">
                <h3>AI分析実行</h3>
                <p>
                  財務指標や
                  <br />
                  市場動向の総合分析
                </p>
                <div className="panel-speech">分析中...ピコピコ📊</div>
              </div>
            </div>

            <div className="manga-panel">
              <div className="panel-number">3</div>
              <div className="panel-icon">📈</div>
              <div className="panel-content">
                <h3>カード表示</h3>
                <p>
                  見やすい
                  <br />
                  分析結果の表示
                </p>
                <div className="panel-speech">見やすいね！</div>
              </div>
            </div>

            <div className="manga-panel">
              <div className="panel-number">4</div>
              <div className="panel-icon">💡</div>
              <div className="panel-content">
                <h3>投資判断の参考</h3>
                <p>
                  強みやリスク
                  <br />
                  将来の成長性
                </p>
                <div className="panel-speech">これで投資判断がしやすい！</div>
              </div>
            </div>
          </div>
        </div>

        {/* 検索機能と株価表示 */}
        <SearchableKarte />

        <div className="back-link">
          <a href="/">ホームに戻る</a>
        </div>
      </main>
    </ProtectedRoute>
  );
}
