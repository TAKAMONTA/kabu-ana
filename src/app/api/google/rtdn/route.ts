import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAdminApp, FirebaseAdminConfigError } from "@/lib/firebase/admin";
import { sanitizeError } from "@/lib/utils/logSanitizer";
import {
  HANDLED_RTDN_SUBSCRIPTION_TYPES,
  parsePubSubPush,
  readRtdnAuthConfig,
  RTDN_SUBSCRIPTION_PURCHASED,
  RTDN_VOIDED_PRODUCT_TYPE_SUBSCRIPTION,
  RtdnAuthError,
  RtdnConfigError,
  RtdnPayloadError,
  verifyPubSubPushToken,
} from "@/lib/purchases/googleRtdn";
import {
  isAllowedNativeProduct,
  PurchaseVerificationError,
} from "@/lib/purchases/nativePurchaseVerification";
import {
  findPurchaseOwner,
  isStoreNotificationProcessed,
  recordStoreNotification,
  type StoreNotificationEvent,
} from "@/lib/purchases/storeNotifications";
import { reverifyAndApplyStoreNotification } from "@/lib/purchases/storeNotificationProcessor";

export const dynamic = "force-dynamic";

const received = () => NextResponse.json({ received: true });

function expectedPackageName(): string {
  return (
    process.env.GOOGLE_PLAY_PACKAGE_NAME ||
    process.env.ANDROID_APPLICATION_ID ||
    "app.vercel.kabu_9t7mdgybz_takamontas_projects.twa"
  );
}

/**
 * Google Play Real-time Developer Notifications の受信（Cloud Pub/Sub push）
 * POST /api/google/rtdn
 *
 * 1. Authorization の OIDC トークンを検証（audience・サービスアカウント）
 * 2. message.data（base64 JSON）の DeveloperNotification を取り出し、packageName を照合
 * 3. Pub/Sub の messageId で重複を除き、purchaseToken から purchase_owners の所有者を引く
 * 4. Google Play Developer API（subscriptionsv2）で再検証した状態を所有者の
 *    subscriptions/{uid} に書く（eventTimeMillis が反映済みの通知より古ければ書かない）
 *
 * 応答: 2xx = ack（再送しない）、それ以外 = Pub/Sub が再送する。一時的な失敗だけ 5xx。
 * 認証済みで形式が不正なメッセージは、再送しても直らないので ack する。
 */
export async function POST(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }

  let type = "unknown";
  try {
    await verifyPubSubPushToken(
      request.headers.get("authorization"),
      readRtdnAuthConfig()
    );

    const body = await request.json().catch(() => null);
    let parsed;
    try {
      parsed = parsePubSubPush(body);
    } catch (error) {
      if (error instanceof RtdnPayloadError) {
        console.warn(`RTDN の形式が不正なため受領のみ: ${sanitizeError(error)}`);
        return received();
      }
      throw error;
    }
    const { messageId, notification } = parsed;

    if (notification.packageName !== expectedPackageName()) {
      console.warn("RTDN を受領（パッケージ名が一致しないため無視）");
      return received();
    }
    if (notification.testNotification) {
      console.info("RTDN のテスト通知を受領しました");
      return received();
    }

    const subscription = notification.subscriptionNotification;
    const voided = notification.voidedPurchaseNotification;
    let purchaseToken: string | undefined;
    let notificationType: number | undefined;
    if (subscription) {
      notificationType = Number(subscription.notificationType);
      type = HANDLED_RTDN_SUBSCRIPTION_TYPES.get(notificationType) ?? String(notificationType);
      if (!HANDLED_RTDN_SUBSCRIPTION_TYPES.has(notificationType)) {
        console.info(`RTDN を受領（反映対象外）: type=${type}`);
        return received();
      }
      purchaseToken = subscription.purchaseToken;
    } else if (
      voided &&
      Number(voided.productType) === RTDN_VOIDED_PRODUCT_TYPE_SUBSCRIPTION
    ) {
      // 定期購入の返金・チャージバック。状態はストアの再検証結果に従う
      type = "VOIDED_PURCHASE";
      purchaseToken = voided.purchaseToken;
    } else {
      console.info("RTDN を受領（定期購入以外の通知）");
      return received();
    }

    const eventAt = Number(notification.eventTimeMillis);
    if (typeof purchaseToken !== "string" || !purchaseToken || !Number.isFinite(eventAt)) {
      console.warn(`RTDN に必要な項目がありません: type=${type}`);
      return received();
    }

    const event: StoreNotificationEvent = {
      platform: "android",
      eventId: messageId,
      type,
      eventAt,
    };

    const app = getAdminApp();
    const db = getFirestore(app);
    if (await isStoreNotificationProcessed(db, event)) {
      console.info(`RTDN の再送を無視しました: type=${type}`);
      return received();
    }

    const serverTimestamp = () => FieldValue.serverTimestamp();
    const owner = await findPurchaseOwner(db, "android", purchaseToken);
    const subscriptionId =
      typeof subscription?.subscriptionId === "string" &&
      isAllowedNativeProduct("android", subscription.subscriptionId)
        ? subscription.subscriptionId
        : undefined;
    const productId =
      owner?.productId && isAllowedNativeProduct("android", owner.productId)
        ? owner.productId
        : subscriptionId;

    // 所有者のいない新しいトークンは、アップグレード等の新規購入（linkedPurchaseToken で
    // 旧トークンの所有者が分かる）に限って再検証する。それ以外はアプリからの登録を待つ
    const canResolveViaLinkedToken =
      !owner && notificationType === RTDN_SUBSCRIPTION_PURCHASED && !!subscriptionId;
    if ((!owner && !canResolveViaLinkedToken) || !productId) {
      console.info(
        `RTDN の購入に所有者がいないか商品を特定できません: type=${type}`
      );
      await recordStoreNotification(db, event, owner ? "ignored" : "no_owner", serverTimestamp);
      return received();
    }

    await reverifyAndApplyStoreNotification(
      {
        db,
        getUser: uid => getAuth(app).getUser(uid),
        serverTimestamp,
      },
      {
        event,
        platform: "android",
        productId,
        purchaseToken,
        stableId: purchaseToken,
        owner,
      }
    );
    return received();
  } catch (error: unknown) {
    if (error instanceof RtdnAuthError) {
      console.warn(`RTDN の認証に失敗しました: ${sanitizeError(error)}`);
      return NextResponse.json(
        { error: "通知の認証に失敗しました" },
        { status: 401 }
      );
    }
    if (error instanceof RtdnConfigError || error instanceof FirebaseAdminConfigError) {
      console.error(`RTDN の設定エラー: ${sanitizeError(error)}`);
      return NextResponse.json(
        { error: "通知の受信設定が完了していません" },
        { status: 503 }
      );
    }
    if (error instanceof PurchaseVerificationError) {
      console.error(
        `RTDN の再検証に失敗しました: type=${type}, ${sanitizeError(error)}`
      );
      return NextResponse.json(
        { error: "購入状態を確認できませんでした" },
        { status: error.statusCode >= 500 ? error.statusCode : 502 }
      );
    }
    console.error(`RTDN の処理エラー: type=${type}, ${sanitizeError(error)}`);
    return NextResponse.json(
      { error: "通知を処理できませんでした" },
      { status: 500 }
    );
  }
}
