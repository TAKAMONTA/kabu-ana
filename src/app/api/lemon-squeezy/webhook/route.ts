import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";
import { getAdminApp, FirebaseAdminConfigError } from "@/lib/firebase/admin";
import { maskId, sanitizeError } from "@/lib/utils/logSanitizer";
import {
  buildSubscriptionEventDocument,
  isUserNotFoundError,
  shouldGrantOneTimeOrder,
  stripUndefined,
  SUBSCRIPTION_INVOICE_EVENTS,
  SUBSCRIPTION_OBJECT_EVENTS,
  toIdString,
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
 * 処理するイベント:
 * - subscription_created / updated / cancelled / resumed / expired / paused / unpaused:
 *   Subscription オブジェクトで subscriptions/{uid} を更新
 * - subscription_payment_*: Subscription invoice オブジェクト。受領のみ
 * - order_created: 一括購入（定期購入 variant 以外・支払い済み）のみ保存
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

    if (eventName && SUBSCRIPTION_INVOICE_EVENTS.has(eventName)) {
      console.info(
        `ℹ️ Invoice event acknowledged: ${eventName}, subscription=${toIdString(
          data?.attributes?.subscription_id
        ) ?? "unknown"}`
      );
      return NextResponse.json({ received: true });
    }

    const isSubscriptionEvent =
      eventName !== undefined && SUBSCRIPTION_OBJECT_EVENTS.has(eventName);
    let orderDecision: { grant: boolean; reason?: string } | null = null;
    if (eventName === "order_created") {
      orderDecision = shouldGrantOneTimeOrder(data?.attributes);
      if (!orderDecision.grant) {
        console.info(
          `ℹ️ order_created ignored: ${orderDecision.reason}, id=${eventId ?? "unknown"}`
        );
        return NextResponse.json({ received: true });
      }
    } else if (!isSubscriptionEvent) {
      console.info(`ℹ️ Unhandled event: ${eventName}`);
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
    const serverTimestamp = () => FieldValue.serverTimestamp();

    if (isSubscriptionEvent) {
      const document = buildSubscriptionEventDocument(
        eventName!,
        userId,
        data,
        serverTimestamp
      );
      await subscriptionRef.set(document, { merge: true });
      console.info(
        `✅ Subscription ${eventName} for user: ${maskId(userId)}, status: ${String(
          document.status
        )}`
      );
    } else {
      // 一括購入（定期購入 variant 以外・支払い済みの注文）
      const orderData = data?.attributes ?? {};
      await subscriptionRef.set(
        stripUndefined({
          userId,
          status: "active",
          platform: "web",
          productId: String(orderData.first_order_item?.product_id ?? ""),
          orderId: toIdString(data?.id),
          purchaseDate: serverTimestamp(),
          expiryDate: null, // 一括購入は有効期限なし
          isTrial: false,
          lemonSqueezyData: {
            orderId: toIdString(data?.id),
            customerId: orderData.customer_id ?? undefined,
            status: orderData.status ?? undefined,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      );

      console.info(`✅ Order created for user: ${maskId(userId)}`);
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
