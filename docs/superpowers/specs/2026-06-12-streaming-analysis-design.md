# 設計仕様：AI分析のストリーミング化（Web先行）

- **日付**: 2026-06-12
- **対象ブランチ**: `feat/design-system`（出荷ライン）から切った `feat/streaming-analysis`
- **目的**: 「AI分析を開始」押下後の10〜30秒の無言スピナーを、即座に流れ始める自然文ブリーフィングに置き換える。既存の構造化ダッシュボードは温存する。
- **実測の出発点**: 本番 `/api/analyze` は構造化JSONを返し、1回あたり約10.5秒（2026-06-12計測）。

## 1. コンセプト — 二部構成ストリーム

レスポンスを2部に分け、構造化出力でもストリーミングを成立させる。

```
[前半] 自然文ブリーフィング（地の文・200〜400字）  ← トークン逐次でストリーム
   ↓ センチネル "===STRUCTURED_JSON==="
[後半] 構造化JSON {investmentAdvice, targetPrice, stopLoss, swot, ...}  ← 受信後にパースしてダッシュボード描画
```

- **OpenRouter呼び出しは1回**（コスト約1倍）。`stream: true` で受信。
- プロンプトに「まず所見を地の文で、改行後にセンチネル、その後にJSON」を指示。
- **フォールバック**: センチネルが出力に無くても、既存 `parseAnalysisResult` の正規表現 `\{[\s\S]*\}` でJSONを抽出し、その手前を所見として扱う。堅牢性の要。

## 2. SSEプロトコル（サーバー→クライアント）

`Content-Type: text/event-stream`。イベント3種：

| event | data | タイミング |
|---|---|---|
| `narrative` | 所見テキストのdelta（生文字列） | OpenRouterのdelta受信ごと（センチネル到達まで） |
| `result` | `AnalysisResult` のJSON文字列（サーバーでパース済み） | ストリーム完了後、1回 |
| `error` | 日本語エラーメッセージ（生文字列） | エラー時 |

整形は `data:` 1行 + 空行区切り。`narrative` の改行は `\n` をエスケープして1行に収め、クライアントで復元する（実装はヘルパー関数に隔離）。

**クライアントは壊れやすいJSONパースを持たない** — `result` でサーバーがパース済みオブジェクトを送る。

## 3. 堅牢性 — 「最初の1チャンク preflight」

`withDailyLimit` は `response.ok`（=200）を見た瞬間に無料利用回数を加算する（`src/lib/utils/dailyUsageLimiter.ts:189`）。素朴に200ストリームを開くと、OpenRouterが402残高切れでも1回消費される。

→ **OpenRouterストリームの最初のチャンクを受信してから200ストリームを返す**。先頭で 401/402/429/timeout が出たらJSONエラー（適切なstatus）を返し、`!response.ok` により回数を消費させない。エラーメッセージは既存 `openrouter.ts` の日本語文言を流用（401→認証、402→残高不足、429→制限、ECONNABORTED→タイムアウト）。

レート/日次ラッパーはストリーミングResponseを素通しできることを実コードで確認済み（bodyをread/cloneせず、`response.ok`とヘッダーのみ操作）。

## 4. トランスポート — プラットフォーム分岐

| 環境 | 経路 | 体験 |
|---|---|---|
| Web（非Capacitor） | ネイティブ `fetch` + `ReadableStream` を逐次read | 文字が流れる |
| iOS（Capacitorネイティブ） | 現行 `CapacitorHttp.post`（応答をバッファ）。同じSSE文字列を**最後に一括**パース | 所見＋ダッシュボードがまとめて出る（回帰なし） |

判定は既存 `useSignalApi.ts` の `isCapacitorNative()` と同じ方式。SSEパースは純粋関数に切り出し、逐次（Web）と一括（iOS）の両方から使う。

## 5. 変更ファイル（最小・加算的）

### 5.1 `src/lib/api/analysisStream.ts`（新規・純粋関数・テスト対象）
- `export const STRUCTURED_JSON_SENTINEL = "===STRUCTURED_JSON===";`
- `formatSSE(event: "narrative" | "result" | "error", data: string): string` — SSEフレーム整形（改行エスケープ込み）。
- `parseSSE(buffer: string): Array<{ event: string; data: string }>` — バッファからイベント列を抽出（改行復元込み）。Web逐次/iOS一括の両方で使用。
- `splitNarrativeAndJson(full: string): { narrative: string; json: string | null }` — センチネル分割。センチネル無し時は最初の `{` 手前を narrative、`{...}` を json とするフォールバック。

### 5.2 `src/lib/api/openrouter.ts`
- `analyzeStockStream(companyInfo, stockData, newsData): AsyncGenerator<string>` を追加。`stream: true` でOpenRouterを呼び、content deltaを逐次yield。最初のyield前に上流の非200を検知したら既存の日本語Errorをthrow（preflight用）。
- `buildAnalysisPrompt` に「まず所見200〜400字 → 改行 → センチネル → JSON」の指示を追記。`max_tokens` を2500→3000へ。
- `parseAnalysisResult` は変更せず再利用（route側がフル文字列に対して呼ぶ）。
- 既存の非ストリーム `analyzeStock` は残す（他の利用箇所の互換、ロールバック余地）。

### 5.3 `src/app/api/analyze/route.ts`
- ハンドラを `ReadableStream` 返却に書き換え。`withRateLimit(withDailyLimit(handler))` は維持。`EXPORT_STATIC` 時の早期return（`{status:"static_export"}`）も維持。
- フロー: バリデーション → APIキー確認 → `analyzeStockStream` を開始 → **最初のチャンクをpreflight**（失敗時はJSONエラーResponse、回数消費なし）→ 成功なら `text/event-stream` の200を返し、delta到達ごとに `narrative` を送出。完了後フル文字列を `parseAnalysisResult` でパースし `result` を送出してclose。途中エラーは `error` イベント。
- preflight成功後にfirst chunkを取りこぼさないこと（バッファして最初のnarrativeに含める）。

### 5.4 `src/hooks/useAIAnalysis.ts`
- `streamingText: string` を状態に追加し返り値に含める。
- `analyzeStock` をプラットフォーム分岐：
  - iOS native: 現行 `CapacitorHttp.post`。返ってきたSSE文字列を `parseSSE` で一括処理し、`narrative` を連結して `streamingText` に一括set、`result` を `analysisResult` にset。
  - Web: `fetch` で `ReadableStream` をreadループ。`narrative` delta到達ごとに `streamingText` を追記更新、`result` で `analysisResult` をset。
  - 非SSE応答（レート/日次のJSONエラー、status非200）は従来通り `error` にset（content-type/statusで判定）。
- `clearAnalysis` で `streamingText` もクリア。`mountedRef` ガードは維持。

### 5.5 `src/components/AnalysisSection.tsx`
- 構造化結果ブロックの**先頭**に「AIブリーフィング」エリアを追加。`isAnalyzing && streamingText` のとき末尾にカーソル点滅を表示。`streamingText` を描画。
- `analysisResult` 到達後は既存の構造化カード群をそのまま下に描画（現行コードを温存）。
- props に `streamingText?: string` を追加。`isAnalyzing` 中でも `streamingText` があれば本文領域を表示するよう分岐を調整（既存の「分析を実行中...」ボタン表示とは両立）。

### 5.6 テスト（vitest, `src/lib/api/__tests__/analysisStream.test.ts`）
- `splitNarrativeAndJson`: センチネルあり／なし（フォールバック）／JSON無し。
- `parseSSE` / `formatSSE`: ラウンドトリップ、改行を含むnarrative、複数イベント連結、バッファ途中の不完全フレーム。
- `STRUCTURED_JSON_SENTINEL` がプロンプトとパーサで同一であることを担保する参照テスト。

## 6. スコープ境界（YAGNI）
- ✅ 所見ストリームを既存ダッシュボードの上に追加。
- ❌ 分析全体のチャット化（EDINET Sprint 3で別途）。
- ❌ iOSのトークン逐次表示（次PR、CORS追加が前提）。
- ❌ モデル変更（別ロードマップ項目）。
- ❌ サーバーへのCORS追加（次PR）。

## 7. 検証
- `npx tsc --noEmit`：新規エラー0（ベースの既存エラーとの差分比較）。
- vitestで新規テスト実行（`vitest run src/lib/api`）。
- `npx next lint`（変更ファイル）：新規エラーなし。
- `EXPORT_STATIC=true next build`：iOS出荷経路が通る。
- 手動: Web devで「AI分析を開始」→ 文字が流れることを目視。
