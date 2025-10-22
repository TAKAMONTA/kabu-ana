# AI 株式分析カルテ - API 設定ガイド

## 📋 概要

このドキュメントでは、AI 株式分析カルテ機能を実際の AI API と連携させるための設定方法を説明します。

## 🔧 必要な環境変数

`.env.local`ファイルを作成し、使用する AI API のキーを設定してください：

```env
# OpenAI API（GPT-4推奨）
OPENAI_API_KEY=your_openai_api_key_here

# Claude API（Claude 3推奨）
CLAUDE_API_KEY=your_claude_api_key_here

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# 株価データAPI（オプション）
YAHOO_FINANCE_API_KEY=your_yahoo_finance_key
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
```

## 🤖 対応 AI API

### 1. OpenAI (GPT-4)

- **取得先**: https://platform.openai.com/
- **料金**: 約$0.03/1K tokens (GPT-4)
- **特徴**: 最も汎用的で安定した分析結果

### 2. Claude (Anthropic)

- **取得先**: https://console.anthropic.com/
- **料金**: 約$0.015/1K tokens (Claude 3)
- **特徴**: 日本語の理解力が高く、詳細な分析が可能

### 3. Google Gemini

- **取得先**: https://makersuite.google.com/app/apikey
- **料金**: 無料枠あり
- **特徴**: コスト効率が良く、基本的な分析に適している

## 🚀 実装手順

### 1. API キーの設定

```bash
# .env.localファイルを作成
touch .env.local

# 必要なAPIキーを追加
echo "OPENAI_API_KEY=sk-..." >> .env.local
```

### 2. API ルートの有効化

`app/api/ai-analysis/route.ts`のコメントアウトされている部分を有効化：

```typescript
// 使用するAPIのコメントを解除
const openaiResponse = await fetch(
  "https://api.openai.com/v1/chat/completions",
  {
    // ... 設定
  }
);
```

### 3. SearchableKarte コンポーネントの更新

`app/karte/SearchableKarte.tsx`の`generateKarte`関数を更新：

```typescript
const generateKarte = async () => {
  if (!selectedStock) return;

  setIsGenerating(true);

  try {
    const response = await fetch("/api/ai-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stockCode: selectedStock.code,
        stockName: selectedStock.name,
        market: selectedStock.market,
      }),
    });

    const data = await response.json();
    setAnalysisData(data);
  } catch (error) {
    console.error("カルテ生成エラー:", error);
  } finally {
    setIsGenerating(false);
  }
};
```

## 📝 プロンプト構造

AI API に送信されるプロンプトは以下の構造になっています：

1. **会社概要**: 事業内容、設立年、従業員数など
2. **基本投資指標**: PER、PBR、配当利回りなど
3. **AI 分析スコア**: 投資魅力度、成長性、リスク評価
4. **財務健全性**: 収益性、安定性、成長性など 5 項目
5. **市場センチメント**: ニュース、アナリスト評価、SNS 言及度
6. **競合比較**: 同業他社との相対評価
7. **テクニカル指標**: トレンド、RSI、移動平均線
8. **投資スタイル適性**: グロース、バリュー、配当など
9. **リスクと機会**: 主要リスク 5 つ、成長機会 5 つ
10. **AI 総合判定**: 買い/様子見/売りの判断と理由

## ⚠️ 注意事項

1. **API キーの管理**
   - API キーは絶対に GitHub にコミットしない
   - `.gitignore`に`.env.local`が含まれていることを確認

2. **レート制限**
   - 各 API にはレート制限があります
   - 必要に応じてキャッシュやレート制限の実装を検討

3. **コスト管理**
   - AI API は従量課金制です
   - 使用量をモニタリングし、必要に応じて制限を設定

4. **エラーハンドリング**
   - API 呼び出しが失敗した場合のフォールバック処理
   - ユーザーへの適切なエラーメッセージ表示

## 🧪 テスト方法

1. モックモードでの動作確認

```bash
npm run dev
# http://localhost:3006/karte でモックデータで動作確認
```

2. API 統合のテスト

```bash
# .env.localにAPIキーを設定後
npm run dev
# 実際のAPI呼び出しをテスト
```

## 📚 参考資料

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Claude API Documentation](https://docs.anthropic.com/claude/reference)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Yahoo Finance API](https://www.yahoofinanceapi.com/)
- [Alpha Vantage Documentation](https://www.alphavantage.co/documentation/)

## 🆘 トラブルシューティング

### API キーが無効

- API キーが正しくコピーされているか確認
- API キーの権限設定を確認

### レスポンスが遅い

- AI API のモデルサイズを調整（GPT-3.5 など軽量モデルの使用）
- タイムアウト設定を調整

### JSON 解析エラー

- プロンプトに JSON 形式の明示的な指示があるか確認
- レスポンスの検証関数（validateAIResponse）を使用
