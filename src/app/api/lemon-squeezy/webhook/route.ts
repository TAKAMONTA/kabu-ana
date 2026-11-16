import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";
import { getAdminApp, FirebaseAdminConfigError } from "@/lib/firebase/admin";
import { maskId, sanitizeError } from "@/lib/utils/logSanitizer";
import {
  isUserNotFoundError,
  planLemonSqueezyWebhook,
  readLemonSqueezyWebhookConfig,
} from "@/lib/lemonSqueezyWebhook";

/**
 * Webhook署名を検証
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(payload).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch {
    return false;
  }
}

export const dynamic = "force-dynamic";

/**
 * Lemon Squeezy Webhook処理
 * POST /api/lemon-squeezy/webhook
 *
 * 処理するイベント（反映ルールは planLemonSqueezyWebhook を参照）:
 * - subscription_created / updated / cancelled / resumed / expired / paused / unpaused:
 *   Subscription オブジェクトで subscriptions/{uid} を更新
 * - subscription_payment_refunded: 全額返金なら Web の購読を expired にする
 * - その他の subscription_payment_*: 受領のみ
 * - order_created: 買い切り variant（LEMON_SQUEEZY_VARIANT_ID_LIFETIME）の支払い済み注文のみ
 * - order_refunded: 買い切りの注文の全額返金なら expired にする
 *
 * 退会済み（Firebase Auth に存在しない）ユーザー宛てのイベントは保存しない
 * （退会後に届く解約・期限切れ通知で subscriptions/{uid} が復活するのを防ぐ）。
 */
export async function POST(request: NextRequest) {
  // 静的エクスポート時はビルドエラーを防ぐためダミーを返す
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }

  let eventName: string | undefined;
  let eventId: string | undefined;
  let userId: string | undefined;

  try {
    // Webhook署名の検証
    const webhookSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("LEMON_SQUEEZY_WEBHOOK_SECRET is not set");
      return NextResponse.json(
        { error: "Webhook is not available" },
        { status: 503 }
      );
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-signature") || "";

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error("Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // ペイロードをパース
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error("Webhook payload is not valid JSON");
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    eventName = payload?.meta?.event_name;
    const customData = payload?.meta?.custom_data || {};
    const data = payload?.data;
    eventId = data?.id !== undefined ? String(data.id) : undefined;

    console.info(`📦 Lemon Squeezy Webhook: ${eventName}`);

    // ユーザーIDの取得（checkout の checkout_data.custom.userId）
    userId = typeof customData.userId === "string" ? customData.userId : undefined;
    if (!userId) {
      console.warn(
        "⚠️ userId not found in custom_data. Skipping Firestore update."
      );
      // userIdがなくても成功を返す（ゲスト購入の可能性）
      return NextResponse.json({ received: true });
    }

    const config = readLemonSqueezyWebhookConfig();
    // Firestore を読まずに判定できる「無視するイベント」はここで返す
    const preliminary = planLemonSqueezyWebhook({
      eventName,
      userId,
      data,
      current: undefined,
      now: new Date(),
      serverTimestamp: () => null,
      config,
    });
    if (
      preliminary.kind === "skip" &&
      [
        "no_event_name",
        "other_store",
        "test_mode",
        "unknown_variant",
        "partial_refund",
        "invoice_acknowledged",
        "order_not_paid",
        "not_lifetime_variant",
        "unhandled_event",
      ].includes(preliminary.reason)
    ) {
      console.info(
        `ℹ️ ${eventName ?? "unknown"} ignored: ${preliminary.reason}, id=${eventId ?? "unknown"}`
      );
      return NextResponse.json({ received: true });
    }

    // Firebase Admin SDKの初期化
    const app = getAdminApp();

    // 退会済みユーザーのデータは作り直さない
    try {
      await getAuth(app).getUser(userId);
    } catch (error) {
      if (isUserNotFoundError(error)) {
        console.info(
          `ℹ️ ${eventName} ignored: user no longer exists (${maskId(userId)})`
        );
        return NextResponse.json({ received: true });
      }
      throw error;
    }

    const db = getFirestore(app);
    const subscriptionRef = db.collection("subscriptions").doc(userId);
    const uid = userId;

    // 現在の文書を読んでから書くまでを1トランザクションにする
    // （同時に届いたイベント同士で古い方が勝たないように）
    const plan = await db.runTransaction(async tx => {
      const snapshot = await tx.get(subscriptionRef);
      const result = planLemonSqueezyWebhook({
        eventName,
        userId: uid,
        data,
        current: snapshot.exists ? snapshot.data() : undefined,
        now: new Date(),
        serverTimestamp: () => FieldValue.serverTimestamp(),
        config,
      });
      if (result.kind === "write") {
        tx.set(subscriptionRef, result.document, { merge: true });
      }
      return result;
    });

    if (plan.kind === "write") {
      console.info(
        `✅ ${eventName} applied for user: ${maskId(userId)}, status: ${String(
          plan.document.status
        )}`
      );
    } else {
      console.info(
        `ℹ️ ${eventName} not applied for user: ${maskId(userId)}, reason: ${plan.reason}, id=${eventId ?? "unknown"}`
      );
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const safeMessage = sanitizeError(error, [userId]);
    // eventId（LSリソースID）は調査用トレーサビリティのため意図的に非マスク（ユーザー直接識別子ではない）
    console.error(
      `Webhook処理エラー: event=${eventName ?? "unknown"}, id=${eventId ?? "unknown"}, message=${safeMessage}`
    );
    if (error instanceof FirebaseAdminConfigError) {
      return NextResponse.json(
        { error: "Webhook is not available" },
        { status: 503 }
      );
    }
    // 詳細はログのみ。非2xxで Lemon Squeezy が再送する
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
