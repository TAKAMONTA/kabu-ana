# マーケット・シグナル 設計書

- **Date**: 2026-05-08
- **Project**: kabu-ana
- **Status**: Approved (brainstorming完了)
- **Author**: Claude Code (with user)

## 1. Overview

kabu-ana に「マーケット・シグナル」タブを新設し、株価に影響する外部シグナル（エネルギー価格・地政学ニュース・地震・異常検知）と、Claude による「なぜ動いた／次に何が起きそうか」分析を一画面に集約する。

ユーザーが kabu-ana を開いたとき、銘柄分析の前に **「今日の市場環境がどうなっているか」を 30 秒で把握** できる状態を作る。

## 2. Goals / Non-Goals

### Goals
- WTI / Brent / 天然ガス / ガソリン在庫 / VIX / USD指数 / 米10年金利 を1ストリップで表示
- 石油・LNG・OPEC・ホルムズ・サウジ・UAE・シェール関連ニュースを重み付き集約
- USGS の M4.5+ 地震を直近7日テーブルで表示
- 5 次元（地政学・エネルギー・海運・災害・サイバー）の投資環境リスクメーター
- 異常検知 → 緊急アラート ティッカー
- 既存 OpenRouter (Claude 3.5 Sonnet) で AI 市場ブリーフ生成
- フリーユーザーも全パネル閲覧可、Claude 深掘り分析のみプレミアム
- Web (Vercel) + Capacitor (iOS/Android) 両対応

### Non-Goals
- 3D グローブ / WebGL マップ（重い・モバイル不利・本質ではない）
- リアルタイム価格ストリーミング（ポーリングで十分）
- 軍事・サイバー攻撃の地理可視化（ジャーナリズム用途、株判断には間接的）
- 多言語対応（kabu-ana は日本市場特化）
- WorldMonitor の Tauri / 5バリアント / 92 proto / Aviation / Wildfires / Webcams 等

## 3. License & Product Differentiation

WorldMonitor (koala73/worldmonitor, AGPL-3.0 + 商用ライセンス必要) を**設計参考**にしている。実コードはコピーしない (clean room implementation)。

- **製品カテゴリの分離**: WorldMonitor は「世界情勢インテリジェンスダッシュボード（記者・OSINT 向け）」、kabu-ana は「株トレーダー向け AI アシスタント」。客層・出力フォーマットが別物。
- **コピーしない**: ソースコード、関数シグネチャ、TypeScript 型定義、UI レイアウトをコピーしない。
- **参考にして良い (= 著作権対象外)**: API URL（事実）、RSS フィードのリスト（事実）、スコアリング数式（数学的事実）、APIレスポンス構造（事実）。
- **WorldMonitor 特有機能の8割を落とす**: 3D グローブ、デスクトップ、多言語、軍事追跡など。
- **UI/UX**: kabu-ana 既存の Tailwind + Radix UI + recharts スタイルで完全独自実装。

## 4. Architecture

### 4.1 ディレクトリ構成

```
kabu-ana-master/src/
├── app/
│   ├── page.tsx                       (既存、変更なし)
│   ├── signals/
│   │   └── page.tsx                   (新規: マーケット・シグナル統合DB)
│   └── api/signals/
│       ├── prices/route.ts            (EIA + FRED 集約)
│       ├── news/route.ts              (RSS 集約 + キーワード重み)
│       ├── seismic/route.ts           (USGS GeoJSON)
│       ├── risk/route.ts              (5次元スコア)
│       ├── claude-brief/route.ts      (Claude 朝サマリー / 深掘り)
│       └── cron/refresh/route.ts      (Vercel Cron で日次バッチ)
├── components/signals/
│   ├── PriceStrip.tsx
│   ├── EnergyNewsBoard.tsx
│   ├── SeismicTable.tsx
│   ├── GeopolRiskGauge.tsx            (5次元レーダー + Composite)
│   ├── AnomalyTicker.tsx
│   ├── ClaudeBriefCard.tsx            (free: 朝サマリー / premium: 深掘り)
│   └── SignalsNav.tsx                 (銘柄分析 / マーケット・シグナル タブ切替)
├── lib/signals/
│   ├── sources/
│   │   ├── eia.ts                     (EIA Open Data v2 アダプタ)
│   │   ├── fred.ts                    (FRED アダプタ)
│   │   ├── usgs.ts                    (USGS Earthquake GeoJSON)
│   │   └── rss.ts                     (RSS 集約 + パーサ)
│   ├── scoring.ts                     (純粋関数: zscore / 重み計算)
│   ├── claude.ts                      (プロンプトテンプレ + zod スキーマ)
│   ├── cache.ts                       (Firestore + Edge Cache ヘルパ)
│   └── keywords.ts                    (重み付きキーワード辞書)
└── hooks/signals/
    ├── usePriceStrip.ts
    ├── useEnergyNews.ts
    ├── useSeismic.ts
    ├── useGeopolRisk.ts
    └── useClaudeBrief.ts
```

### 4.2 データフロー

```
[Vercel Cron 06:00 JST]
  ↓ /api/signals/cron/refresh
  ├→ EIA / FRED 取得 → Firestore: signals_prices/{date}
  ├→ RSS 取得 → Firestore: signals_news/{id}
  ├→ USGS 取得 → Firestore: signals_seismic/{id}
  ├→ ベースライン更新 → Firestore: signals_baseline/{date}
  ├→ Risk 計算 → Firestore: signals_risk/{date}
  └→ Claude 朝サマリー生成 → Firestore: signals_brief/{date}

[ユーザーアクセス]
  ↓ /signals
  各 hook が API Route → Firestore 読み出し（Edge cache）
  深掘り Claude のみ on-demand で OpenRouter 呼び出し
```

## 5. Data Sources

| カテゴリ | API/フィード | エンドポイント概要 | 認証 | 更新頻度 | キャッシュ |
|---|---|---|---|---|---|
| WTI 原油先物 | EIA Open Data v2 | `petroleum/pri/spt/data/?series_id=RWTC` | API キー（無料） | 日次 | Edge 5分 |
| Brent 原油先物 | EIA | `petroleum/pri/spt/data/?series_id=RBRTE` | 同上 | 日次 | Edge 5分 |
| 米ガソリン在庫 | EIA | `petroleum/stoc/wstk/data/?series_id=WGTSTUS1` | 同上 | 週次 | Edge 30分 |
| 天然ガス Henry Hub | EIA | `natural-gas/pri/fut/data/` | 同上 | 日次 | Edge 5分 |
| VIX 恐怖指数 | FRED | `series/observations?series_id=VIXCLS` | API キー（無料） | 日次 | Edge 5分 |
| USD インデックス | FRED | `series_id=DTWEXBGS` | 同上 | 日次 | Edge 5分 |
| 米10年金利 | FRED | `series_id=DGS10` | 同上 | 日次 | Edge 5分 |
| 地震 (M4.5+ 7日) | USGS | `earthquake.usgs.gov/.../4.5_week.geojson` | 不要 | 5分 | Edge 3分 |
| エネルギー・地政学ニュース | RSS 集約 | 下表 | 不要 | 15分 | Firestore + Edge |
| 日経225 / TOPIX | 既存 SERPAPI | （既存） | 既存 | リアルタイム | 既存 |

### 5.1 RSS ソース（重み付き）

| ソース | 主にカバー | 重み |
|---|---|---|
| Reuters Energy | グローバル / OPEC / 制裁 | 1.0 |
| Bloomberg Energy (RSS) | マーケット / 価格変動 | 1.0 |
| OilPrice.com | シェール / OPEC+ | 0.8 |
| Argus Media headlines | LNG / 物理マーケット | 0.9 |
| Hellenic Shipping News | ホルムズ / 海上ルート | 0.9 |
| MEES (Middle East Economic Survey) | サウジ / UAE | 0.9 |
| Energy Voice | プロジェクト | 0.6 |
| JOGMEC ニュース | 日本視点・LNG調達 | 0.7 |
| Reuters World | 地政学全般 | 0.8 |
| BBC World | 地政学全般 | 0.7 |
| AP News | 速報 | 0.7 |

### 5.2 キーワード重み

`src/lib/signals/keywords.ts`:

```ts
export const KEYWORD_WEIGHTS: Record<string, number> = {
  "Hormuz": 3.0, "ホルムズ": 3.0,
  "OPEC+": 2.5, "OPEC": 2.0,
  "Saudi Aramco": 2.0, "サウジ": 1.8,
  "UAE": 1.5, "Abu Dhabi": 1.5,
  "shale": 1.5, "シェール": 1.5,
  "LNG": 2.0,
  "sanction": 2.0, "制裁": 2.0,
  "tanker": 2.0, "タンカー": 2.0,
  "strike on": 3.0,
  "earthquake M7": 2.0,
  "cyber attack": 1.5,
  "grain export": 1.0,
};
```

ニュース1件のスコア:
```
score = sourceWeight × Σ(keywordWeight for matched keywords)
score >= 4.0 ⇒ Hot ラベル
score >= 7.0 ⇒ Critical → AnomalyTicker に昇格
```

## 6. Anomaly Scoring (5次元 Risk Vector)

`src/lib/signals/scoring.ts`:

```ts
export interface RiskVector {
  geopol:   number;  // 0-10
  energy:   number;  // 0-10
  maritime: number;  // 0-10
  disaster: number;  // 0-10
  cyber:    number;  // 0-10
}

// 株への効きで重み付け
const COMPOSITE_WEIGHTS = {
  geopol: 0.30, energy: 0.25, maritime: 0.20,
  disaster: 0.15, cyber: 0.10,
};
```

各次元の計算（ベースライン = 過去30日）:

```
energyScore =
  + zscore(WTI_24h_change, baseline_30d)   * 1.5
  + zscore(Brent_24h_change, baseline_30d) * 1.5
  + zscore(NatGas_24h_change, baseline_30d) * 1.0
  + clamp(0, 3, gasoline_inventory_zscore_negated)
  + criticalNewsCount(["OPEC cut", "Hormuz", "shale halt"], 24h) * 1.0
  → clamp(0, 10)

maritimeScore =
  + criticalNewsCount(["Hormuz", "Strait", "tanker", "missile"], 24h) * 2.0
  + abnormalShippingDelays_score
  → clamp(0, 10)

disasterScore =
  + maxMagnitude_24h(USGS) * 1.0
  + count_M5plus_24h * 0.5
  → clamp(0, 10)

geopolScore =
  + criticalNewsCount(geopolKeywords, 24h) * 1.5
  + zscore(geopolNewsVolume_24h, baseline_14d)
  → clamp(0, 10)

cyberScore =
  + criticalNewsCount(["cyber attack", "ransomware"], 24h) * 1.5
  → clamp(0, 10)
```

### 6.1 Anomaly Ticker 昇格条件

- 任意次元 `score >= 7.0`
- Composite 24h delta `>= +3.0`
- 単一ニュースの重み `>= 7.0`

### 6.2 ベースライン

- 過去30日の日次変動標準偏差 → zscore 計算用
- 過去14日の同時間帯ニュース件数 → ボリューム異常検知用
- Vercel Cron で毎朝 03:00 JST に Firestore `signals_baseline/{date}` 更新
- 最初の14日間は「ベースライン収集中」と表示し、スコアは表示しない（過剰反応防止）

## 7. Claude Integration

既存 OpenRouter (Claude 3.5 Sonnet) をそのまま使う。Anthropic SDK 直接導入はしない（コスト・キー管理の追加を避ける）。

`src/lib/signals/claude.ts` にプロンプトテンプレと zod レスポンスバリデータを置く。

### 7.1 朝のサマリー（毎朝 06:00 JST、Vercel Cron）

入力: 直近24hの全シグナル（価格変動・Top 5 ニュース・地震 ≥M5・Risk Vector）。
出力（JSON強制、zod でバリデート）:

```ts
{
  headline_jp: string,         // 最大15字
  summary_jp: string,          // 120字以内
  key_drivers: { factor: string, impact: string }[],
  stocks_to_watch: { ticker: string, reason: string, direction: "up"|"down"|"watch" }[],
  risk_outlook: "low"|"elevated"|"high"|"critical",
}
```

### 7.2 シグナル深掘り（プレミアム、ユーザーがカードクリック）

入力: 単一シグナル + 同時刻の関連ニュース。
出力: 「なぜ動いた」原因仮説 3 つ + 「次に何が起きそうか」シナリオ 3 つ + 各シナリオのトリガー指標。

### 7.3 銘柄影響分析（既存 /analyze 統合、プレミアム）

既存 `useAIAnalysis` の入力に「現在の Risk Vector」を追加。既存銘柄詳細ページの分析が「現在の地政学リスクが 7.2/10、特にホルムズが高い影響下では…」という文脈を持つ。

### 7.4 コスト管理

- 朝サマリー: 1日1回固定（≒$0.02/日）
- 深掘り: プレミアムユーザー1日10回まで（Firestore でカウント）
- フリーユーザー: 朝サマリーのみ閲覧可、深掘りは CTA 表示

## 8. Premium Gating & Mobile

### 8.1 プレミアム判定

既存 `SubscriptionStatus` と `useAuth` フックを再利用。`ClaudeBriefCard` の「深掘り」ボタンと、既存銘柄分析の Risk Vector 文脈差し込みのみがプレミアム。

### 8.2 Capacitor 対応

- WebGL / Three.js / globe.gl / deck.gl 系の依存は**入れない**
- recharts は既存依存、そのまま使う
- データ取得は API Route 経由（既存パターンと同じ、`window.location.origin` ベース）
- スクロール1本で完結する縦並びレイアウト
- iOS Safe Area / ステータスバー考慮（既存パターン踏襲）

## 9. Error Handling & Graceful Degradation

- 各パネルは独立してエラー表示。1ソースが落ちても他は動く。
- API Route は 200 で `{ data: T | null, error?: string, lastSuccessfulAt?: ISO }` を返す（HTTP エラーで UI 全体が壊れない）
- フロントは last-known-good を Firestore から読み「最終更新: 12分前」と表示
- ベースライン未収集期間（最初の14日）は「ベースライン収集中」表示
- API キー未設定の環境変数チェック → `data: null` 経路で UI は壊れない

## 10. Testing

- **単体**: `scoring.ts`, `keywords.ts`, `eia.ts`, `fred.ts`, `usgs.ts`, `rss.ts` パーサ等の純粋関数 (vitest)
- **API**: `/api/signals/*/route.ts` を `next/test` パターンでモック fetch
- **E2E**: 既存 e2e ディレクトリに `signals.spec.ts` 追加 — `/signals` がレンダリングされ、価格カードが表示されるところまで（既存 e2e ツール踏襲）
- **目標カバレッジ**: 純粋関数 80%+、API Route 60%+

## 11. Observability

- Firestore に `signals_run_log/{timestamp}` で各バッチの成否・所要時間を記録
- Vercel Logs + 既存 `@opentelemetry/api`
- Claude コスト追跡: `signals_claude_log/{date}` にトークン数・モデル・コスト保存

## 12. Environment Variables

`.env.local` に追加:

```
EIA_API_KEY=...                    # https://www.eia.gov/opendata/register.php
FRED_API_KEY=...                   # https://fred.stlouisfed.org/docs/api/api_key.html
SIGNALS_CRON_SECRET=...            # /api/signals/cron/refresh の Authorization 検証用

# 既存（参考、変更なし）
OPENROUTER_API_KEY=...             # Claude 呼び出しは既存
SERPAPI_API_KEY=...                # 株価は既存
```

## 13. Out of Scope (明示)

- WebGL マップ / 3D グローブ
- リアルタイム価格 WebSocket
- 多言語対応（日本語のみ）
- Tauri デスクトップビルド
- 軍事・GPS 妨害・海底ケーブル監視
- 動画/Webcam ストリーミング
- 直接 Anthropic SDK 統合（OpenRouter 経由で十分）

## 14. Open Questions / Follow-ups

- E2E テストフレームワーク確認（kabu-ana に Playwright か Cypress か未確認 → 実装時に既存に合わせる）
- vitest 既存採用の確認（package.json になければ追加）
- Firestore セキュリティルール: `signals_*` コレクションは read public / write server-only に設定する必要あり（実装時に `firestore.rules` 更新）
- Vercel Cron の上限プラン確認（Hobby は1日1ジョブ制限あり、必要なら Pro）

## 15. Acceptance Criteria

実装完了時、以下が満たされる：

1. `/signals` を開くと、PriceStrip / EnergyNewsBoard / SeismicTable / GeopolRiskGauge / AnomalyTicker / ClaudeBriefCard が縦並びで表示される
2. 各パネルは独立にローディング/エラー状態を持ち、1ソース障害が他を壊さない
3. ホルムズ・OPEC・サウジ・UAE・シェール関連ニュースがキーワードヒットで Hot/Critical ラベル付きで表示される
4. USGS から M4.5+ の地震が直近7日テーブルで降順表示される
5. 5次元 Risk Vector がレーダーチャートで表示され、Composite スコアが大きく表示される
6. Composite ≥7.0 または単一シグナル重み ≥7.0 のものが Anomaly Ticker に流れる
7. Claude 朝サマリーがフリーユーザーにも表示される
8. 深掘り分析がプレミアムユーザーのみで動作し、フリーは CTA 表示
9. iOS/Android Capacitor ビルドで `/signals` が表示でき、スクロール操作が破綻しない
10. Vercel Cron で日次バッチが回り、Firestore に履歴が蓄積される
