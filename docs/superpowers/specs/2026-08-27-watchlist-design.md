# ウォッチリスト設計書（Sprint 4 第1弾）

日付: 2026-08-27 / 対象ブランチ: `feat/watchlist` / ベース: master

## 目的

気になる銘柄を登録して一覧で見られるようにする。Sprint 4（ウォッチリスト＋朝ダイジェスト＋ホーム＋タブバー）の土台であり、本設計は**ウォッチリスト単体**を出し切る。

## 決定事項（ユーザー承認済み）

| 論点 | 決定 |
|---|---|
| 対象ユーザー | **ログインした人のみ**。未ログインには「ログインすると登録できます」と案内 |
| 保存場所 | Firestore `users/{uid}/watchlist/{code}`。保存するのは `code`・`name`・`addedAt` のみ。株価は保存しない |
| 無料上限 | **3銘柄**（プレミアムは無制限）。クライアントとサーバーの両方で判定 |
| 一覧の表示内容 | 銘柄名・コード＋**前日終値・前日比** |
| 株価の鮮度 | 前日終値（J-Quants、当日16:30更新）。**「終値・前日比（J-Quants は当日16:30更新）」の注記と「◯月◯日 終値」の日付を画面に常時表示**（ユーザー明示要望）。日付は `getStockData` に `asOf` を追加して取得する |
| 配置 | **案A**: 既存の1画面のまま、検索欄の直下にウォッチリスト節を追加。下タブ化（案B）は将来の別スプリント |
| 登録の入口 | 検索結果の銘柄名の横に★ボタン。押すと登録、再度押すと解除。楽観更新（即時に見た目を変え、失敗時は戻してインラインで通知） |
| 削除 | 一覧の行スワイプまたはメニューから。確認を挟む |

## アーキテクチャ

### データ層: `useWatchlist` フック

`claude/cranky-fermat` の `5c147ff:src/hooks/useWatchlist.ts`（221行）を参考に新規作成する（コピーではなく、現行の認証・課金判定に合わせて書き直す）。

- **読み取り**は Firestore 購読（onSnapshot）で `users/{uid}/watchlist` を監視
- **書き込みはフックが直接 Firestore に書かず、後述のサーバーAPI（POST/DELETE）を呼ぶ**（上限をサーバーで強制するため）
- `add(code, name)` / `remove(code)` / `has(code)` / `items` / `limit` / `canAdd`
- docID は銘柄コード（`7203` / `130A` 等。マスタのコード表記をそのまま使う）
- 上限判定: `isPremium`（既存の課金判定）を使い、無料は3件

### Firestore セキュリティルール

`users/{uid}/watchlist/{code}` は本人のみ読み取り可。**書き込みはサーバーAPI経由に限定**（下記）し、ルールではクライアントからの直接書き込みを禁止する。ルール側で件数上限は強制できないため、サーバーAPIの判定が唯一の強制点になる。

### サーバーAPI: `/api/watchlist/quotes`

- `GET /api/watchlist/quotes?codes=7203,6758,2559`（上限20コード/回）
- 認証必須（`verifyAuth`。設定エラーは503、トークン不正は401 — PR #30 の分岐を踏襲）
- 各コードについて `createMarketDataClient()`（`MarketDataRouter`）の `getStockData` で終値・前日比・**取得できた営業日（`asOf`）**を返す
- **サーバー側キャッシュ**: コード単位で当日中（最低15分）は使い回す。J-Quants の値は1営業日1回しか変わらないため
- 一部コードの取得失敗は、そのコードだけ `null` で返す（全体は200）
- `EXPORT_STATIC === "true"` 時はダミー応答（既存ルートの慣例に従う）
- レスポンス例: `{ quotes: { "7203": { close: 3020, changePercent: 1.2, asOf: "2026-08-26" }, "9999": null } }`

### 登録・削除API（上限のサーバー側強制）

- `POST /api/watchlist`（body: `{ code, name }`）／`DELETE /api/watchlist/{code}`。どちらも認証必須、Admin SDK で書く
- POST はサーバーで件数を数え、無料3件を超える追加を **403** で拒否（プレミアムは無制限）
- 入力検証は trim 基準（PR #28 の方針。空白のみ・不正JSONは400）
- 読み取り（一覧の購読）はクライアントの onSnapshot のまま

### UI

- `src/components/WatchlistSection.tsx` 新規。既存の実装慣例に従う: `<Card>`（`src/components/ui/card.tsx`）でラップ、数値は `tabular-nums`、騰落色は既存慣例どおり `text-green-600` / `text-red-600`（+ `dark:` バリアント）を直書き、絵文字禁止、Lucide アイコン
- ★トグルは **`StockPriceHeaderCard`**（`src/components/StockSidePanel.tsx` 内の別 export。`page.tsx` が直接呼んでおり、実際に銘柄名が見えているのはこちら）に追加する。`StockSidePanel` 本体は `showPriceHeader={false}` で呼ばれており銘柄名ヘッダーを描画していない
- `WatchlistSection` は **2箇所**に配置する: 検索後は `page.tsx` の検索欄直後、検索前（フロントページ）は `src/components/frontpage/MarketFrontPage.tsx` の `searchSlot` 直後
- 行タップで該当銘柄の検索を実行（既存の検索フローを呼ぶ）

### 状態別表示

| 状態 | 表示 |
|---|---|
| 未ログイン | 案内文＋ログインボタン（既存 AuthModal を開く） |
| 0件 | 「検索して★を押すと、ここに並びます」 |
| 上限到達 | 見出しに「3 / 3」。★押下時に「無料プランは3銘柄までです」（トースト基盤が無いためインライン表示で実装） |
| 株価取得失敗 | 銘柄名は表示、株価欄のみ「—」。**一覧は消さない** |

## エラー時の振る舞い（大原則: 一覧は消さない）

| 事象 | 挙動 |
|---|---|
| quotes API 失敗（全体） | 一覧は名前のみ表示、株価欄「—」、控えめな再試行導線 |
| quotes API 一部失敗 | 取れた分は表示、失敗行のみ「—」 |
| Firebase Admin 設定エラー | 503「サービスが利用できません」（認証失敗と区別。PR #30 の方針） |
| 上限超過 | クライアントで事前に案内、サーバーでも403（サーバー側の判定が唯一の強制点） |
| タイムアウト | `optionalWithTimeout`（既存共通 util）で打ち切り、株価のみ「—」 |

## テスト方針

**自動テストはサーバー側とロジック層のみ**（ユーザー判断）。このリポジトリには React コンポーネント／フックのテストが1件も存在せず、`jsdom` も `@testing-library/react` も未導入のため、UI レンダリングテストは今回のスコープに含めない。テスト基盤の導入は別途検討する。

1. **純ロジック**: 上限判定・コード正規化・quotes レスポンスの整形など、React に依存しない関数として切り出して単体テスト
2. **API ルート**: 既存の `src/app/api/**/__tests__/route.test.ts` の流儀（`NextRequest` を直接構築、`@/lib/firebase/admin` の `getAdminApp` をモック）に従う。認証（503/401）・入力検証（400）・上限（403）・一部失敗で該当コードのみ null・全部失敗でも200・キャッシュが効くこと・20コード上限
3. **`getStockData` の `asOf` 追加**: 既存テストが退行しないことを確認したうえで、`asOf` が `bars` の最終行の日付になることを検証
4. **実データ検証（mock 緑だけで完了にしない）**: 開発サーバーで実際にログイン→★登録→再読み込みで残存→quotes が実際の J-Quants の終値・営業日を返すことを確認。`asOf` が直近営業日であることを目視確認。UI の4状態（未ログイン・0件・上限・株価なし）も**実機で手動確認**する

既存スイートを減らさないこと。lint 警告を増やさないこと。

## 今回やらないこと（非スコープ）

下タブ・ホーム画面・朝のダイジェスト・通知・並べ替え・メモ・米国株の扱い最適化（登録は可能だが Twelve Data の無料枠制約はキャッシュで緩和するに留める）・未ログイン時の端末保存。

## 参考

- 旧下書き: `git show 5c147ff -- src/hooks/useWatchlist.ts`（保存形式の参考。UIは不採用）
- 認証の実例: `src/app/api/subscription/refresh/route.ts`（`verifyAuth` + `isAuthError` + `authResult.uid` の定型）。※ `subscription/check/route.ts` は `verifyAuth` を使わず独自に `verifyIdToken` を呼ぶ旧実装なので参考にしない
- サーバー側の isPremium 判定: uid から判定する共通関数は存在しない。`src/app/api/signals/claude-brief/route.ts` のインライン Firestore クエリ（`subscriptions/{uid}` の status と expiryDate を見る）を踏襲する
- クライアントの isPremium: `src/hooks/useSubscription.ts` が返す `isPremium`
- API 呼び出しの作法: `getAuthHeaders()` + `getApiUrl()`（`src/lib/utils/apiClient.ts`）と `CapacitorHttp`。実例は `src/hooks/signals/useClaudeBrief.ts`
- Firestore 購読の実例: `src/hooks/useSubscription.ts`（単一ドキュメント）。コレクション購読の前例はリポジトリに無い
- 既存のルール: `firestore.rules` に `users/` 系のブロックは無い（新規追加が必要。Firestore はデフォルト拒否）
- 旧下書き: `git show 5c147ff -- src/hooks/useWatchlist.ts`（保存形式の参考。書き込みが直接 Firestore を叩く点・フィールド名・API名は本設計と異なるため流用不可）
