# ストアのサーバー通知（App Store / Google Play）の設定手順

ネイティブ課金の更新・期限切れ・返金・取り消しを、利用者がアプリを開かなくても
`subscriptions/{uid}` に反映するための、ストア側コンソールと Vercel の設定です。
コードは次の 2 つの受信 API です。

| ストア | 受信 URL | 認証 |
|---|---|---|
| App Store Server Notifications **V2** | `https://kabu-ana.com/api/apple/notifications` | JWS 署名（Apple Root CA - G3 まで検証） |
| Google Play RTDN（Cloud Pub/Sub push） | `https://kabu-ana.com/api/google/rtdn` | Pub/Sub の OIDC トークン（audience とサービスアカウントを照合） |

どちらも通知の中身は「変化の合図」としてだけ使い、状態は既存の App Store Server API /
Google Play Developer API で再検証した結果を書きます。所有者は `purchase_owners`
（アプリからの購入登録時に作成）で決まるため、**アプリで一度も登録されていない購入は反映されません**
（従来どおり `/api/subscription/update` が登録します）。

## 1. Vercel の環境変数（Production）

既存の購入検証用の変数（`APP_STORE_CONNECT_*`, `GOOGLE_PLAY_*`, `IOS_BUNDLE_ID` など）に加えて:

| 変数 | 値 | 必須 |
|---|---|---|
| `APP_STORE_APP_APPLE_ID` | App Store Connect の「App 情報」にある **Apple ID**（数字） | 本番通知の検証に必須 |
| `GOOGLE_RTDN_PUSH_AUDIENCE` | push サブスクリプションに設定する audience。下の手順どおりなら `https://kabu-ana.com/api/google/rtdn` | 必須 |
| `GOOGLE_RTDN_PUSH_SERVICE_ACCOUNT_EMAIL` | push 認証用サービスアカウントのメール（例: `rtdn-push@<PROJECT_ID>.iam.gserviceaccount.com`） | 必須 |
| `APPLE_NOTIFICATIONS_ONLINE_CHECKS` | `false` で証明書の失効確認（OCSP）を止める。通常は未設定 | 任意 |

未設定のまま通知が届くと 503 を返します（Apple / Pub/Sub が再送するので、設定後に取りこぼしは回復します）。
**環境変数を先に設定・デプロイしてから**、ストア側の設定をしてください。

## 2. App Store Connect

1. App Store Connect → 対象アプリ → **App 情報** → **App Store サーバ通知**（App Store Server Notifications）
2. **本番サーバ URL**: `https://kabu-ana.com/api/apple/notifications`、バージョンは **Version 2**
3. **Sandbox サーバ URL**: 同じ URL で可（Sandbox の通知も受け付けます）
4. 保存

画面の名前・場所は変わることがあります。最新は Apple のヘルプ
「[Enter a URL for App Store Server Notifications](https://help.apple.com/app-store-connect/#/dev0067a330b)」を参照してください。

補足:
- Apple は 2xx 以外を受けると、本番のみ 1・12・24・48・72 時間後に再送します（Sandbox は再送なし）。
- 疎通確認は App Store Server API の「Request a Test Notification」で送れます（`TEST` 通知は受領のみで何も書きません）。

## 3. Google Cloud（Pub/Sub）と Play Console

`<PROJECT_ID>` は Google Play と連携している Google Cloud プロジェクトの ID です。

```bash
gcloud config set project <PROJECT_ID>
```

1. トピックを作成

```bash
gcloud pubsub topics create play-rtdn
```

2. Google Play にトピックへの発行権限を付与

```bash
gcloud pubsub topics add-iam-policy-binding play-rtdn --member="serviceAccount:google-play-developer-notifications@system.gserviceaccount.com" --role="roles/pubsub.publisher"
```

3. push 認証用のサービスアカウントを作成（鍵の発行は不要）

```bash
gcloud iam service-accounts create rtdn-push --display-name="RTDN push auth"
```

4. push サブスクリプションを作成（OIDC トークン付き）

```bash
gcloud pubsub subscriptions create play-rtdn-push --topic=play-rtdn --push-endpoint=https://kabu-ana.com/api/google/rtdn --push-auth-service-account=rtdn-push@<PROJECT_ID>.iam.gserviceaccount.com --push-auth-token-audience=https://kabu-ana.com/api/google/rtdn
```

- サブスクリプションを作る人に、このサービスアカウントの `iam.serviceAccounts.actAs`（「サービス アカウント ユーザー」ロール）が必要です。
- 2021-04-08 以前に作成したプロジェクトでは、Pub/Sub サービスエージェントに
  `roles/iam.serviceAccountTokenCreator` の付与が必要です（[Pub/Sub の認証ドキュメント](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions)）。
- audience を省略した場合の既定値は push エンドポイント URL です。`GOOGLE_RTDN_PUSH_AUDIENCE` と必ず同じ値にしてください。

5. Play Console → 対象アプリ → **収益化** → **収益化のセットアップ** → **リアルタイム デベロッパー通知**
   - 「リアルタイム通知を有効にする」をオン
   - トピック名: `projects/<PROJECT_ID>/topics/play-rtdn`
   - 通知の種類: **定期購入とすべての無効化された購入の通知を受け取る**
   - 「テスト メッセージを送信」→ 保存

補足:
- Pub/Sub は 2xx 以外を受けると再送します。署名付きで形式が壊れたメッセージは再送しても直らないため受領（2xx）します。
- 設定手順の原典: [Google Play Billing「Configure Real-time developer notifications」](https://developer.android.com/google/play/billing/getting-ready)

## 4. Firestore（任意）

- 重複排除の記録は `store_notifications/{hash}` に保存します（uid・購入IDは含みません）。
  Firestore の TTL ポリシーを `store_notifications` の `expireAt` に設定すると 90 日後に自動削除されます。
- `firestore.rules` はこのコレクションに一致する `match` がないため、クライアントからは読み書きできません（Admin SDK 専用）。

## 5. 動作確認

- Vercel のログで `ストア通知を処理しました: platform=... outcome=applied` を確認
- 401 が続く場合: Apple は bundleId・Apple ID・環境の不一致、Google は audience / サービスアカウントのメールの不一致を疑う
- 反映されない場合のログの `outcome`:
  - `no_owner`: アプリから購入登録されていない（または退会済み）
  - `other_purchase`: 利用者の現在の購読が別の購入（Web 購読など）で、通知側が有効でもないため上書きしなかった
  - `stale`: 反映済みの通知より古い

## 既存のクライアント側フォールバック

`src/lib/purchases/nativeRefresh.ts`（アプリ起動・復帰時の `/api/subscription/refresh`）はそのまま残しています。
通知の取りこぼしや、通知より前の状態の補正に使えるため、通知の運用が安定するまでは削除しないでください。
