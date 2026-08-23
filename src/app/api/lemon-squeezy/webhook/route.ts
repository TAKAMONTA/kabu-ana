import { NextRequest, NextResponse } from "next/server";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";
import { getAdminApp } from "@/lib/firebase/admin";
import { maskId, sanitizeError } from "@/lib/utils/logSanitizer";

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

export const dynamic =
  process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

/**
 * Lemon Squeezy Webhook処理
 * POST /api/lemon-squeezy/webhook
 *
 * 処理するイベント:
 * - subscription_created: サブスクリプション作成
 * - subscription_updated: サブスクリプション更新
 * - subscription_cancelled: サブスクリプションキャンセル
 * - subscription_payment_success: 支払い成功
 * - order_created: 注文作成（一括購入）
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
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-signature") || "";

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error("Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // ペイロードをパース
    const payload = JSON.parse(rawBody);
    eventName = payload.meta?.event_name;
    const customData = payload.meta?.custom_data || {};
    const data = payload.data;
    eventId = data?.id !== undefined ? String(data.id) : undefined;

    console.info(`📦 Lemon Squeezy Webhook: ${eventName}`);

    // ユーザーIDの取得
    userId = customData.userId;
    if (!userId) {
      console.warn(
        "⚠️ userId not found in custom_data. Skipping Firestore update."
      );
      // userIdがなくても成功を返す（ゲスト購入の可能性）
      return NextResponse.json({ received: true });
    }

    // Firebase Admin SDKの初期化
    const app = getAdminApp();
    const db = getFirestore(app);
    const subscriptionRef = db.collection("subscriptions").doc(userId);

    // イベントに応じて処理
    switch (eventName) {
      case "subscription_created":
      case "subscription_payment_success": {
        const subscriptionData = data.attributes;
        const expiryDate = subscriptionData.renews_at
          ? new Date(subscriptionData.renews_at)
          : null;

        await subscriptionRef.set(
          {
            userId,
            status: "active",
            platform: "web",
            productId: String(subscriptionData.product_id),
            orderId: String(data.id),
            purchaseDate: FieldValue.serverTimestamp(),
            expiryDate: expiryDate,
            isTrial: subscriptionData.status === "on_trial",
            lemonSqueezyData: {
              subscriptionId: data.id,
              customerId: subscriptionData.customer_id,
              variantId: subscriptionData.variant_id,
              status: subscriptionData.status,
            },
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.info(
          `✅ Subscription created/renewed for user: ${maskId(userId)}`
        );
        break;
      }

      case "subscription_updated": {
        const subscriptionData = data.attributes;
        const expiryDate = subscriptionData.renews_at
          ? new Date(subscriptionData.renews_at)
          : null;

        // ステータスのマッピング
        let status: string;
        switch (subscriptionData.status) {
          case "active":
            status = "active";
            break;
          case "on_trial":
            status = "trial";
            break;
          case "paused":
          case "past_due":
            status = "pending";
            break;
          case "cancelled":
          case "expired":
            status = "cancelled";
            break;
          default:
            status = "pending";
        }

        await subscriptionRef.set(
          {
            status,
            expiryDate: expiryDate,
            isTrial: subscriptionData.status === "on_trial",
            lemonSqueezyData: {
              subscriptionId: data.id,
              status: subscriptionData.status,
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.info(
          `✅ Subscription updated for user: ${maskId(userId)}, status: ${status}`
        );
        break;
      }

      case "subscription_cancelled": {
        const subscriptionData = data.attributes;
        const endsAt = subscriptionData.ends_at
          ? new Date(subscriptionData.ends_at)
          : null;

        await subscriptionRef.set(
          {
            status: "cancelled",
            expiryDate: endsAt, // キャンセル後も期限まで有効
            lemonSqueezyData: {
              subscriptionId: data.id,
              status: "cancelled",
              cancelledAt: subscriptionData.cancelled_at,
              endsAt: subscriptionData.ends_at,
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.info(`✅ Subscription cancelled for user: ${maskId(userId)}`);
        break;
      }

      case "order_created": {
        // 一括購入の場合
        const orderData = data.attributes;

        await subscriptionRef.set(
          {
            userId,
            status: "active",
            platform: "web",
            productId: String(orderData.first_order_item?.product_id || ""),
            orderId: String(data.id),
            purchaseDate: FieldValue.serverTimestamp(),
            expiryDate: null, // 一括購入は有効期限なし
            isTrial: false,
            lemonSqueezyData: {
              orderId: data.id,
              customerId: orderData.customer_id,
              status: orderData.status,
            },
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.info(`✅ Order created for user: ${maskId(userId)}`);
        break;
      }

      default:
        console.info(`ℹ️ Unhandled event: ${eventName}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    const safeMessage = sanitizeError(error, [userId]);
    // eventId（LSリソースID）は調査用トレーサビリティのため意図的に非マスク（ユーザー直接識別子ではない）
    console.error(
      `Webhook処理エラー: event=${eventName ?? "unknown"}, id=${eventId ?? "unknown"}, message=${safeMessage}`
    );
    return NextResponse.json(
      { error: safeMessage || "Webhook processing failed" },
      { status: 500 }
    );
  }
}
