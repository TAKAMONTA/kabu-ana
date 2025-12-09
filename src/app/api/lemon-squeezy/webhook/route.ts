import { NextRequest, NextResponse } from "next/server";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import crypto from "crypto";

// Firebase Admin SDKの初期化
let adminApp: App | null = null;

function getAdminApp() {
  if (adminApp) {
    return adminApp;
  }

  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY環境変数が設定されていません");
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    adminApp = initializeApp({
      credential: cert(serviceAccount),
    });
    return adminApp;
  } catch (error) {
    console.error("Firebase Admin SDK初期化エラー:", error);
    throw new Error("Firebase Admin SDKの初期化に失敗しました");
  }
}

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
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // ペイロードをパース
    const payload = JSON.parse(rawBody);
    const eventName = payload.meta?.event_name;
    const customData = payload.meta?.custom_data || {};
    const data = payload.data;

    console.log(`📦 Lemon Squeezy Webhook: ${eventName}`);
    console.log("Custom Data:", customData);

    // ユーザーIDの取得
    const userId = customData.userId;
    if (!userId) {
      console.warn("⚠️ userId not found in custom_data. Skipping Firestore update.");
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

        console.log(`✅ Subscription created/renewed for user: ${userId}`);
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

        console.log(`✅ Subscription updated for user: ${userId}, status: ${status}`);
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

        console.log(`✅ Subscription cancelled for user: ${userId}`);
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

        console.log(`✅ Order created for user: ${userId}`);
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event: ${eventName}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook処理エラー:", error);
    return NextResponse.json(
      { error: error.message || "Webhook processing failed" },
      { status: 500 }
    );
  }
}

