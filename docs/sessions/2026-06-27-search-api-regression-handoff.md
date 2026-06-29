# 本番 /api/search 表示崩れ 引き継ぎ書

**作成:** 2026-06-27 / **対象本番:** https://kabu-ana.com / **再現銘柄:** 8136（サンリオ）, 7203（トヨタ）
**状況:** SerpAPI→J-Quants/Twelve Data 移行（PR #18, merge `9120033`）を本番 Promote 後、銘柄詳細の表示が複数箇所で崩れている。
**注:** 本書の数値は分析に必要な公開株価情報のみ。APIキー・個人情報・シークレットは含まない。

---

## TL;DR（最重要・3点）

1. **本番の `stockData` は新クライアント（J-Quants/Twelve Data）ではなく、いまだ `SerpApiClient` が応答している。** 移行は本番に実質反映されていない。
   最有力原因 → **Vercel 環境変数 `MARKET_DATA_PROVIDER=serpapi` が残存**している疑い（要確認・最優先）。ファクトリは未設定なら `router`（=新経路）になるので、SerpApi が出ている＝この変数が立っている。
2. **前回の「本番スモーク緑」（7203=2768, AAPL=283.78）は誤検証だった。** `price>0` しか見ておらず、応答していたのは SerpApi だった可能性が高い。J-Quants/Twelve Data は本番ランタイムで一度も実証できていない。
3. 表示崩れ（前日比%が約100倍／時価総額¥1.39）は **SerpApi 経路に起因**。`MARKET_DATA_PROVIDER` を外して新経路へ切り替えれば解消する見込みだが、**新経路が本番(Vercel)で実応答するかは未検証**（Yahoo はここで死んだ。J-Quants は `x-api-key` 認証APIなのでIPブロックの懸念は低いが要確認）。

---

## 確定事実（生データ + コード根拠）

### 本番 8136 生レスポンス（`POST /api/search {"query":"8136","chartPeriod":"1M"}`）
```jsonc
companyInfo: { name:"サンリオ", symbol:"8136", market:"TYO", description:"プライム / 卸売業",
               price:1092, change:86.5, changePercent:860.2684999999999 }
stockData:   { symbol:"8136", price:1092, change:86.5, changePercent:860.268…,
               volume:28450300.000000004, marketCap:"1.39兆", pe:25.99, eps:0,
               dividend:1.26, high52:0, low52:0 }
financialData: { revenue:"55518000000", netIncome:"16161000000",
                 operatingIncome:"23215000000", totalLiabilities:"72245000000",
                 cash:"107202000000", period:"Dec 2025 (四半期期間)" }
newsData: 10件取得OK / chartData: 24点取得OK（date は "May 27 2026, 03:00 PM UTC+09:00" 形式）
TOP KEYS: companyInfo, stockData, newsData, chartData, financialData, edinetCode,
          accountingStandard, ratios, financialHistory, metadata
```

### 問題1【P0】本番 stockData は SerpApi 出力（移行未反映）
- `src/app/api/search/route.ts:166-239` — 日本株は `localJpxStock` 経路に入り、`stockData = serpStockData`（= `marketApi.getStockData()` の戻り値）で上書きされる。`marketApi = createMarketDataClient()`。
- 本番値は私の `JQuantsClient.getStockData`（`src/lib/api/jquants.ts:401`）と**構造的に矛盾**：
  - 私の実装は `high52/low52` を1年分 bars から `Math.max/min` 計算 → `price=1092` が出るなら `high52>0` のはず。本番は `high52:0, low52:0`。
  - 私の実装は `pe:0, dividend:0, marketCap:"N/A"` 固定。本番は `pe:25.99, dividend:1.26, marketCap:"1.39兆"`。
- 一方 `src/lib/api/serpapi.ts:500-581 getStockData` は `pe/dividend/marketCap` を返し、52週レンジ取得失敗時に `high52/low52 = parseFloat(...)||0` で **0** になる。→ **本番値は SerpApi 出力と完全一致**。
- ファクトリ `src/lib/api/marketDataClient.ts`：`provider = MARKET_DATA_PROVIDER ?? "router"`。`provider==="serpapi" && 実キー` のときだけ `SerpApiClient`、それ以外は `MarketDataRouter`。
  → **本番が SerpApi = `MARKET_DATA_PROVIDER=serpapi` が Vercel にある**（最有力）。

### 問題2【P1】前日比 % が約100倍（860.27%）
- `src/lib/api/serpapi.ts:151,215,401,574` — すべて `changePercent: (data.summary.price_movement?.percentage || 0) * 100`。
- フロント `src/components/StockSidePanel.tsx:149` — `stockData.changePercent.toFixed(2)}%` でそのまま表示（フロントは×100していない）。
- 8136 実値は +8.6%（86.5 / (1092-86.5) ≒ 0.086）。SerpApi の `percentage` が既に「%値(8.6)」を返しており、`*100` で 860.27% になっている。
- **J-Quants 経路（`jquants.ts:413` `changePercent = ((price-prevC)/prevC)*100`）に切り替われば ×100 の二重化は無くなる**ので、問題1の解消（新経路化）でこれも直る見込み。
- ※「なぜ今顕在化したか」は未確定。仮説：(a) Task4 で route.ts の130行 FMPフォールバックブロックを削除 → 以前 FMP が stockData を上書きしていた分が露出、(b) Google Finance の `percentage` 単位変化。FMP は Legacy 全滅（既知）なので (a) は要検証。

### 問題3【P1】時価総額が「¥1.39」と崩れる
- 本番 `marketCap:"1.39兆"`（SerpApi の文字列）。
- フロント `src/components/StockSidePanel.tsx:166` `formatMarketCap(stockData.marketCap)` が "兆" 付き文字列を解釈できず数値部だけ拾って「¥1.39」表示（`formatMarketCap` 実装を要確認）。
- J-Quants 経路では `marketCap:"N/A"` になり、この崩れは消える（ただし時価総額自体は出ない＝機能劣化）。

### 問題4【P2】財務健全性評価（BS/PL/CF）が全項目エラー
- エンドポイント：`src/app/api/financial-evaluation/route.ts`（未精読）。画面は「BS/PL/CF の評価を取得できませんでした」「財務評価中にエラーが発生しました」。
- 今回の移行起因か、元々の別系統障害（例: OpenRouter）かは**切り分け未実施**。`financialData` に BS/CF 項目（totalLiabilities/cash）は来ているので、入力欠落というより評価ロジック/AI呼び出し側の疑い。

### 問題5【P2】ニュース AI 影響分析がエラー
- エンドポイント：`src/app/api/news-analysis/route.ts`（未精読）。画面は「ニュース分析中にエラーが発生しました」。
- ニュース取得自体は成功（`newsData` 10件）。**AI 分析呼び出し側の失敗**。移行起因かは未切り分け（OpenRouter 402 等の既往あり＝メモリ参照）。

---

## 検証で使ったコマンド（再現用）
```bash
# 本番生レスポンス（stockData の生フィールドを確認）
curl -s -X POST https://kabu-ana.com/api/search -H "Content-Type: application/json" \
  -d '{"query":"8136","chartPeriod":"1M"}' | python3 -m json.tool

# SerpApi のフィールド構造・×100箇所
rg -n "changePercent|high52|low52|marketCap|dividend" src/lib/api/serpapi.ts
# フロント表示
rg -n "changePercent|marketCap" src/components/StockSidePanel.tsx
```

---

## 次のアクション（推奨順）

### Step 1【最優先・5分】Vercel 環境変数を確認
- Vercel → kabu-ana → Settings → Environment Variables で **`MARKET_DATA_PROVIDER` の有無**を確認。
  - **あれば削除**（または値を `router` 以外にしない）。`JQUANTS_API_KEY` / `TWELVE_DATA_API_KEY` は登録済み（今朝 Production+Preview に追加）。
  - 削除後 **Redeploy → Promote** して再度 8136/7203/AAPL の生レスポンスを取得。`stockData.pe` が `0`、`marketCap` が `"N/A"`、`changePercent` が現実的な値（数%）になれば**新経路に切り替わった証拠**。

### Step 2【本番ランタイム検証】新経路が Vercel で実応答するか
- `MARKET_DATA_PROVIDER` 除去後、本番 `curl` で 7203（J-Quants）/ AAPL（Twelve Data）が `price>0` かつ **`pe:0,marketCap:"N/A"`（=新経路の指紋）** で返るか確認。
- price だけで判断しない（前回の誤検証の再発防止 ← `feedback-verify-external-integrations-live`）。新経路特有のフィールド指紋（pe=0, marketCap="N/A", high52>0）で判定すること。

### Step 3【UI 契約の修正】どちらの経路でも UI が壊れないように
- `changePercent`：×100 二重化を恒久対策。SerpApi を緊急時に使う可能性が残るなら `serpapi.ts` の `*100` を実データで正す/統一。クライアント間で `changePercent` の単位（%値で統一）を**契約として固定**。
- `formatMarketCap`（`StockSidePanel.tsx:166` 経由）：`"N/A"` と `"1.39兆"` の両形式を安全に表示できるよう修正。

### Step 4【別系統】financial-evaluation / news-analysis のエラー切り分け
- それぞれ単体で `curl` し、エラー本文/サーバログ（Vercel Runtime Logs）を確認。OpenRouter キー/レート（402 既往）か、入力データ形式かを特定。今回の移行と独立の可能性あり。

### 即時復旧オプション（暫定）
- **A**: Vercel `MARKET_DATA_PROVIDER=serpapi` のまま、`serpapi.ts` の `*100` と `formatMarketCap` だけ応急修正（表示は直るがコスト削減目的は未達）。
- **B（本筋）**: `MARKET_DATA_PROVIDER` 除去で新経路へ。Step 2 検証必須。
- **C**: Vercel Instant Rollback で既知の安定版へ退避してから腰を据えて B。

---

## 重要メモ / 落とし穴
- このプロジェクトは **master マージ＝Preview のみ。Production は手動 Promote**。
- `SERPAPI_API_KEY` は**まだ解約禁止**（現に本番を支えている）。新経路が本番で安定実証できるまで残す。
- 移行コードの単体テストは全緑（`src/lib/api/__tests__/*`）。**だが UI フィールド契約（単位/型/表示）と本番ランタイム経路は未検証だった**＝今回の根本。完了判定は「UIで実銘柄を見る」まで含める。
- 関連メモリ：`project-yahoo-finance-unviable`, `feedback-verify-external-integrations-live`。

## 関連ファイル
- `src/app/api/search/route.ts`（stockData 組み立て・localJpx経路 166-239 / EDINET 391-485）
- `src/lib/api/marketDataClient.ts`（ファクトリ・provider 分岐）
- `src/lib/api/serpapi.ts`（×100: 151,215,401,574 / getStockData: 500-581）
- `src/lib/api/jquants.ts`（新・日本株） / `src/lib/api/twelveData.ts`（新・米国株） / `src/lib/api/marketDataRouter.ts`（振り分け）
- `src/components/StockSidePanel.tsx`（changePercent:149 / marketCap:166）
- `src/app/api/financial-evaluation/route.ts` / `src/app/api/news-analysis/route.ts`（評価系・要調査）
