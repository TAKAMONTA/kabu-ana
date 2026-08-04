# アプリ全体健全性監査 総合レポート（2026-08-03）

**対象:** kabu-ana 全体（Web + モバイルシェル） / **ブランチ:** `chore/health-audit-202608`（master 起点、19コミット）
**方式:** subagent-driven（implementer→spec/quality reviewer のループ、決済系は3巡）
**計画書:** `docs/superpowers/plans/2026-08-03-app-health-audit.md`

---

## エグゼクティブサマリ

コア（型・テスト・ビルド・実API疎通）は当初から健全。一方「守り」に重大な穴が4系統あり、**P0/P1 の10項目をすべて修正済み**。モバイル（Capacitor 8 化WIP）は**出荷不可と判定**（環境・互換性の2ブロッカーを特定）。

| 指標 | 監査前 | 監査後 |
|---|---|---|
| ESLint | **実行不能**（設定破損） | exit 0（エラー0 / any警告138を上限ラチェット） |
| `npm run build` | 成功→（lint蘇生で一時失敗） | 成功 |
| テスト | 128 pass | **154 pass**（+26: logSanitizer 18 / rateLimiter 8） |
| 脆弱性（--production） | 15件（Critical 1 / High 6） | **10件（Critical 0 / High 2※受容文書化済）** |
| `npm ci` | **失敗**（lockfile不整合） | 成功 |
| CI 品質ゲート | 皆無 | `ci.yml` 新設（envなしworktreeで5ステップ実測緑） |
| 決済ログの識別情報 | userId/CustomData 平文出力 | 全遮断（3巡レビューAPPROVE） |
| レート制限 | 2/17ルート | AI直結3ルート追加 + ルート単位バケット隔離 |

---

## 実施内容（コミット対応表）

| Task | 内容 | 主要コミット |
|---|---|---|
| 0 | Capacitor8 WIP を `chore/capacitor-8-upgrade` へ退避、監査ブランチ作成 | `04f0c8d`（退避先） |
| 1 | ESLint復旧: ESLint9専用flat config（5ヶ月前の誤併存）を削除し `.eslintrc.json` へ統合 | `ea04962` |
| 1b | any→warn降格・未使用変数9+require1解消で **build復旧** | `ab26b46` `20f7b76` |
| 1c | lint `--no-cache --max-warnings=138` ラチェット化、デッド関数 `verifyWebhookSignature`(lib側劣化版) 削除 | `5ab1f7c` |
| 1d | android/ios/backend を ignorePatterns 追加（スキャン巻き込み予防） | `aea852e` |
| 2 | lockfile修復（npm ci復旧）+ audit fix（Critical websocket-driver 解消） | `24d0a9c` `4bdbbe0` |
| 3 | 決済Webhook/退会/checkout のログ漏えい遮断。`logSanitizer.ts` 新設（maskId + sanitizeError=マスク→200字切詰→marker） | `6d9e529` `803a884` `d227f0e` `ddab90e` |
| 4 | subscription/check の idToken を Authorization ヘッダー優先化（クエリは後方互換FB+非推奨warn）。**リポジトリ内に呼び出し元ゼロ**（既配布バイナリ専用）と判明 | `d4c69aa` |
| 5 | AI直結3ルート（financial-evaluation / news-analysis / claude-brief GET+POST）へ `withRateLimit`。**claude-brief GET が唯一の無認証OpenRouter経路**と特定し封鎖 | `6f97264` |
| 5b | limiterバケットを `IP:ルートパス` に隔離（NAT配下の巻き添え429防止）、デッド設定値削除 | `33ae294` |
| 6 | CI品質ゲート `.github/workflows/ci.yml`（PR/master push で tsc→lint→vitest→build、Node20、15分timeout） | `fbf141e` |
| 7 | 本番AI機能診断: **6/27の財務評価/ニュース分析エラーは解消済み**（7203/8136で200+構造化応答を確認） | 修正不要 |
| 8 | .env.example: 未記載5変数追記（全て参照行の裏取り済）+ FMP残骸削除 | `bb4099d` |
| 9 | モバイルビルド検証 → **下記のとおり出荷不可判定** | worktree検証のみ |
| - | フォーマッタ整形差分の反映（ロジック変更なし） | `8195b5d` `45b9f5f` `c115de3` |

---

## モバイル（Task 9）の判定: Capacitor 8 WIP は現状出荷不可

検証は隔離worktreeで実施（メインリポジトリ無影響）。

| | 結果 | ブロッカー |
|---|---|---|
| Android | ❌ | **ホストに Java 21 が無い**（WIPは AGP 8.13/Java 21 要求、環境は 17.0.17）。設定自体は仕様準拠 |
| iOS | ❌ | **`@capgo/native-purchases@8.6.4` の podspec が CocoaPods 1.16.2 非対応**（`has_storekit_265_sdk?` 未定義）。Pods/lock 再生成でも解消せず = lock陳腐化ではなく podspec レベルの非互換 |
| 副産物 | ✅ | `npm run build:static`（26ページ）と `cap sync android` は Capacitor 8 で成功 |

**再開条件:** ① Java 21 導入（`brew install openjdk@21` 等） ② CocoaPods 更新 or `@capgo/native-purchases` の互換バージョン調査 ③ `chore/capacitor-8-upgrade` に Podfile.lock 更新コミットが必要（申し送り）。

---

## P2 バックログ（今回未着手・根拠付き）

1. **`no-explicit-any` 138件の漸減** — ラチェット（上限138）導入済みで増殖は防止。減らすたびに上限を下げる運用を推奨
2. **Next 14→15/16 メジャー更新** — 残存 High 2件（next本体/同梱postcss）はこれでしか解消しない。個別キャンペーン推奨
3. **uuid系 Moderate 8件** — firebase-admin メジャー更新待ち。脆弱経路（v3/v5/v6への外部buf）は内部利用では不使用と評価し受容
4. **レート制限の本格化** — Redis/Upstash化・キーのユーザーID化・XFF最左詐称対策・**claude-brief GET の認証必須化**・429時のGET応答形状（現契約は常時200、hookが生「HTTP 429」を表示し得る）
5. **APIルート17本/components38/hooks17のテスト0本** — 決済（webhook/checkout/subscription）・認証（user/delete）から。今回の第1修正ラウンドで実際に起きた「idsToMask渡し忘れ」型欠陥はハンドラテストでしか検出できない（reviewer申し送り）
6. **serpapi.ts（789行）+ `ENABLE_LEGACY_SERPAPI` の撤去** — SerpAPIキー失効 **2026-08-20 以降**に実施。Vercel の `SERPAPI_API_KEY` も同時削除
7. **backend/（NestJS・孤立）の去就** — ユーザー判断事項
8. **小粒**: 死んだprops（`AskSectionProps.dailyLimit`/`SearchSectionProps.setSearchQuery` と page.tsx の受け渡し）/ 新UIに52週レンジ表示が無い（high52/low52未消費、product判断）/ checkout の `includes("404")` 文字列判定の脆さ / maskId は6文字未満IDをマスクしない仕様の周知 / console.log残（今回対象外分）/ `next lint` は scripts/ を見ない
9. **環境ノート**: rtk hook 経由の lint/build がビルド成果物を誤スキャンする癖（`rtk proxy` で回避可）/ `.claude/settings.local.json` に自動追加された `Bash(env)` 許可は広範なので見直し推奨

---

## 出荷手順（このブランチ）

1. `git push -u origin chore/health-audit-202608` → PR 作成（**CI初回実走 = ci.yml の実地検証を兼ねる**）
2. CI緑を確認 → master マージ
3. Vercel Deployments で **手動 Promote to Production**（このプロジェクトの運用）
4. 本番スモーク: `/api/search`（7203/AAPL、経路指紋=pe:0/marketCap:"N/A"）+ 決済フローの正常動作 + `/signals` 表示
5. 数日、Vercel Runtime Logs で 429 の出方（巻き添え有無）と警告ログを観察

## キャンペーン完了条件の充足

① lint完走 ✅ ② audit Critical/High=0 or 文書化受容 ✅ ③ webhookログ識別情報なし（grep全数ゼロ・3巡APPROVE） ✅ ④ CIワークフロー作成+envなし実測緑 ✅（実走はPR時） ⑤ 本番AI機能の状態確定 ✅（解消済み） ⑥ モバイルビルド成否確定 ✅（不可と確定・再開条件明記） ⑦ 本レポート ✅
