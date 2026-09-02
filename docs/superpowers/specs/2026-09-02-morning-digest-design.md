# 朝のダイジェスト設計書（Sprint 4 第2弾）

日付: 2026-09-02 / 対象ブランチ: `feat/morning-digest`（master 起点で新規作成） / ベース: master（ウォッチリスト PR #32 マージ済み）

## 目的

ウォッチリスト登録銘柄について、AIが作る個人向けの日次ダイジェストをアプリ内で届ける。「毎朝開く理由」を作り、ウォッチリスト（Sprint 4 第1弾）の価値を回収する。

## 決定事項（ユーザー承認済み）

| 論点 | 決定 |
|---|---|
| 届け方 | **アプリ内表示のみ**。プッシュ通知・メールは今回やらない（通知基盤が存在しないため別スプリント） |
| 生成タイミング | **その日最初に開いたときに生成して保存**（オンデマンド＋日次キャッシュ）。cron・全ユーザー一括生成はしない |
| 提供範囲 | **全ログインユーザーに1日1回**。無料/プレミアムの差はつけない |
| 形式 | **案A: 1枚のダイジェストカード**。①市場全体のひとこと ②銘柄ごとに1行 ③今日の注目点、の計5〜8行 |

## 前提となる既存実装（実地調査済み）

- **全体版の先例**: `src/app/api/signals/claude-brief/route.ts` が「GET時に遅延生成 → Firestore `signals_brief/{todayId}` に日次キャッシュ」方式で稼働中。本機能はその**個人版**であり、同じ方式を踏襲する
- AI 呼び出し: OpenRouter（`anthropic/claude-sonnet-4-5`）を axios で直接叩く形が claude-brief の実装（`route.ts:97-125`）。システムプロンプトはルート内の日本語リテラル
- 株価: `marketDataClient.getStockData(code)`＋`optionalWithTimeout`（watchlist/quotes と同じ部品）。`asOf` で基準日が取れる
- ニュース: `FreeNewsClient`（Google News RSS / Yahoo Finance）。銘柄ごとの見出し取得が既存
- 通知基盤（FCM/APNs/メール）はリポジトリに存在しない（grep でゼロ確認）
- `collectionGroup` は不要になった（オンデマンド方式のため。本人の watchlist を Admin SDK で読むだけ）

## アーキテクチャ

### データフロー（1リクエストの流れ）

```
GET /api/digest
  → verifyAuth（設定エラー503 / トークン不正401。PR #30 の分岐）
  → Firestore user_digests/{uid}_{JST日付} を読む
      あり(status=ready)   → そのまま返す（2回目以降はここで終わり）
      あり(status=generating かつ 2分以内) → { status: "generating" } を返す（クライアントは数秒後に再取得）
      あり(status=generating かつ 2分超) → 生成が途中で死んだとみなし、上書きで生成し直す
      あり(status=error) → そのまま error を返す（再試行ボタン押下時のみ ?retry=1 で上書き生成）
      なし → 生成へ
  → 生成:
      1. users/{uid}/watchlist を addedAt 降順で読む（一覧の表示順と同じ）。0件なら { status: "empty" }
      2. 先頭10銘柄を要約対象にする（超過分は対象外。カードに「10銘柄まで」注記）
      3. user_digests へ status=generating で create()（既存なら create 失敗＝他リクエストが生成中 → generating 応答）
      4. 各銘柄の株価（marketDataClient + optionalWithTimeout 8秒）とニュース見出し上位2件（FreeNews + optionalWithTimeout）を並列取得。部分失敗は許容（その銘柄は「データなし」でAIに渡す）
      5. OpenRouter に1回だけ要約を依頼（JSON応答を指定）
      6. パース成功 → status=ready で保存して返す / 失敗 → status=error で保存し「作成できませんでした」を返す
```

### 保存: Firestore `user_digests/{uid}_{YYYY-MM-DD}`

| フィールド | 内容 |
|---|---|
| `uid` | 所有者（**退会時削除のクエリに必須**） |
| `dateId` | JST の日付文字列（YYYY-MM-DD） |
| `status` | `generating` / `ready` / `error` |
| `marketLine` | 市場全体のひとこと（1行） |
| `stockLines` | `[{ code, name, line }]` 銘柄ごとの1行（最大10件） |
| `focusLine` | 今日の注目点（1行） |
| `codes` | 要約対象にした銘柄コード配列 |
| `asOf` | 株価の基準日（quotes と同じ意味） |
| `createdAt` | serverTimestamp |

- **Firestore ルール変更は不要**。`user_digests` はデフォルト拒否のままにし、読み書きはすべて Admin SDK（このAPI）経由
- **1日の境界は JST の日付**。「朝」と名乗るが、その日いつ開いても同じ内容（J-Quants の値が1営業日1回しか変わらないため、日中に作り直す意味がない）
- 古いダイジェストは削除しない（1ユーザー1日1件・数百バイトで、当面の量は無視できる。掃除は将来の課題として明記）

### 退会時の削除（第1弾の教訓）

`/api/user/delete` に `user_digests` の削除を追加する: `where("uid", "==", userId)` で取得してバッチ削除。第1弾で「退会後にデータが残る」穴を塞いだばかりなので、**新しい個人データを作る本機能は最初から削除経路を含める**。

### AI 呼び出し

- claude-brief と同じ: OpenRouter / `anthropic/claude-sonnet-4-5` / axios / 日本語システムプロンプトはルート内リテラル
- 入力: 銘柄ごとの { コード、名前、前日終値、前日比%、ニュース見出し（最大2件、無い銘柄は「ニュースなし」） }
- 出力は **JSON を指定**（`{"marketLine": "...", "stockLines": [{"code": "...", "line": "..."}], "focusLine": "..."}`）。パース失敗時は再試行せず error 扱い（コスト暴走防止）
- 再生成は **status=error の doc がある場合のみ**許可（再試行ボタン → 既存 doc を上書きして生成し直す）。ready の再生成手段は作らない
- 投資助言にならない文体（事実の整理と注目点の提示。断定的な売買推奨はプロンプトで禁止）

### UI: `DigestSection`（新規コンポーネント）

- 配置: `MarketFrontPage` に `digestSlot` prop を追加し、**`watchlistSlot` の直上**に描画（検索前のトップのみ。検索後は出さない — 調べ物モードの邪魔をしない）
- カード見出し: 「9月2日の朝ダイジェスト」（日付は dateId から整形。アイコンは lucide-react の Sunrise 等、絵文字不使用）
- 状態別表示:

| 状態 | 表示 |
|---|---|
| 未ログイン / ウォッチリスト0件 | **セクションごと非表示**（登録の案内は既にウォッチリストが担う） |
| 生成中（初回 or generating 応答） | 「今日のダイジェストを作成しています…」＋3秒間隔で自動再取得（最大5回。超えたら失敗表示に切替） |
| 表示 | 市場のひとこと → 銘柄ごとの1行（コード併記・`normalizeDisplayText` 適用）→ 今日の注目点。11銘柄以上登録時は「先頭10銘柄を要約」の注記 |
| 失敗 | 「今日は作成できませんでした」＋再試行ボタン（**無言で消さない** — 静かな失敗の家訓） |

- フックは `useDigest`（新規）。`CapacitorHttp` + `getAuthHeaders` + `getApiUrl` の既存作法。ウォッチリストの `items` を props で受け、0件なら fetch 自体をしない
- 免責の一文をカード下部に固定表示: 「AIによる情報整理であり、投資助言ではありません」

## エラー時の振る舞い（大原則: 無言にしない）

| 事象 | 挙動 |
|---|---|
| 株価・ニュースの部分失敗 | その銘柄は「データ取得できず」としてAIに渡し、生成は続行 |
| 全銘柄のデータ失敗 / AI失敗 / JSONパース失敗 | status=error 保存 + `console.error`（sanitizeError 経由）+ 画面は失敗表示＋再試行 |
| 認証・設定エラー | verifyAuth の 401/503 をそのまま（quotes と同じ） |
| 二重オープン | create() の衝突で片方だけ生成。負けた側は generating 応答 → 自動再取得 |

## テスト方針（第1弾と同じ）

1. **純ロジック**: JST日付ID生成、AI応答JSONの検証・整形（`parseDigestResponse`: 不正JSON・欠けフィールド・stockLines 過剰を弾く）を純関数に切り出して単体テスト
2. **APIルート**: 既存の `route.test.ts` 流儀（verifyAuth モック / firebase-admin モック / OpenRouter モック）。キャッシュヒット・generating 衝突・0件・部分失敗継続・AI失敗で error 保存・401/503
3. **変異テスト**: 「1日1回」の強制（create 衝突分岐）と「error 時のみ再生成」の分岐を壊すとテストが落ちることを確認
4. **実データ検証**: dev サーバーで実際に生成 → 実在銘柄の実ニュース・実株価が要約に反映されること、2回目が保存版であること（OpenRouter 呼び出しが増えないこと）を確認。UIレンダリングテストは書かない（基盤なし・ユーザー決定済み）

## 今回やらないこと（非スコープ）

プッシュ通知・メール / cron による事前一括生成 / 銘柄ごとの詳細分析（案B） / 無料・有料の差別化 / 過去ダイジェストの履歴閲覧 / 古いダイジェストの自動削除 / ready 状態の再生成

## 参考（実装時に見るファイル）

- 方式の先例: `src/app/api/signals/claude-brief/route.ts`（遅延生成＋日次キャッシュ＋OpenRouter 直叩き）
- 認証: `verifyAuth` + `isAuthError`（`src/lib/auth/verifyAuth.ts`）
- 株価: `src/app/api/watchlist/quotes/route.ts`（marketDataClient + optionalWithTimeout の使い方）
- ニュース: `FreeNewsClient`（`src/lib/api/freeNews.ts`）。日本語銘柄名クエリは400になる既知事実あり → 既存の呼び出し方を踏襲すること
- 退会削除: `src/app/api/user/delete/route.ts`（第1弾で recursiveDelete を追加済み。その直後に user_digests のバッチ削除を足す）
- ログ: `sanitizeError`（`src/lib/utils/logSanitizer.ts`）
- UI慣例: `src/components/WatchlistSection.tsx`（Card・tabular-nums・インライン通知・normalizeDisplayText）
