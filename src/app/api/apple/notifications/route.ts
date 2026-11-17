import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAdminApp, FirebaseAdminConfigError } from "@/lib/firebase/admin";
import { sanitizeError } from "@/lib/utils/logSanitizer";
import {
  AppleNotificationConfigError,
  AppleNotificationVerificationError,
  HANDLED_APPLE_NOTIFICATION_TYPES,
  verifyAppleNotification,
} from "@/lib/purchases/appleNotifications";
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

/**
 * App Store Server Notifications v2 の受信
 * POST /api/apple/notifications
 *
 * 1. signedPayload の JWS を Apple Root CA - G3 までの証明書チェーン・bundleId・
 *    appAppleId（本番）・environment で検証する
 * 2. notificationUUID で重複を除き、data.signedTransactionInfo の
 *    originalTransactionId から purchase_owners の所有者を引く
 * 3. App Store Server API で再検証した状態を、所有者の subscriptions/{uid} に書く
 *    （signedDate が反映済みの通知より古ければ書かない）
 *
 * 応答: 2xx = 受領（Apple は再送しない）、4xx/5xx = Apple が再送する
 * （本番のみ。1・12・24・48・72 時間後）。一時的な失敗だけ 5xx を返す。
 */
export async function POST(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }

  const body = await request.json().catch(() => null);
  const signedPayload =
    body && typeof body === "object" ? (body as { signedPayload?: unknown }).signedPayload : undefined;
  if (typeof signedPayload !== "string" || !signedPayload) {
    return NextResponse.json({ error: "通知の形式が不正です" }, { status: 400 });
  }

  let notificationType = "unknown";
  try {
    const verified = await verifyAppleNotification(signedPayload);
    const { notification, transaction } = verified;
    notificationType = String(notification.notificationType ?? "unknown");
    const type = notification.subtype
      ? `${notificationType}/${notification.subtype}`
      : notificationType;

    if (!HANDLED_APPLE_NOTIFICATION_TYPES.has(notificationType)) {
      console.info(`Apple 通知を受領（反映対象外）: type=${type}`);
      return received();
    }

    const notificationUUID = notification.notificationUUID;
    const signedDate = Number(notification.signedDate);
    const originalTransactionId = transaction?.originalTransactionId;
    const transactionId = transaction?.transactionId;
    const productId = transaction?.productId;
    if (
      !notificationUUID ||
      !Number.isFinite(signedDate) ||
      !originalTransactionId ||
      !transactionId ||
      !productId
    ) {
      console.warn(`Apple 通知に必要な項目がありません: type=${type}`);
      return received();
    }
    if (!isAllowedNativeProduct("ios", productId)) {
      console.info(`Apple 通知を受領（許可リスト外の商品）: type=${type}`);
      return received();
    }

    const event: StoreNotificationEvent = {
      platform: "ios",
      eventId: notificationUUID,
      type,
      eventAt: signedDate,
    };

    const app = getAdminApp();
    const db = getFirestore(app);
    if (await isStoreNotificationProcessed(db, event)) {
      console.info(`Apple 通知の再送を無視しました: type=${type}`);
      return received();
    }

    const owner = await findPurchaseOwner(db, "ios", originalTransactionId);
    if (!owner) {
      // アプリから未登録（/api/subscription/update 前）か、退会で所有記録を解放済み
      console.info(`Apple 通知の購入に所有者がいません: type=${type}`);
      await recordStoreNotification(db, event, "no_owner", () =>
        FieldValue.serverTimestamp()
      );
      return received();
    }

    await reverifyAndApplyStoreNotification(
      {
        db,
        getUser: uid => getAuth(app).getUser(uid),
        serverTimestamp: () => FieldValue.serverTimestamp(),
      },
      {
        event,
        platform: "ios",
        productId,
        purchaseToken: transactionId,
        stableId: originalTransactionId,
        owner,
      }
    );
    return received();
  } catch (error: unknown) {
    if (error instanceof AppleNotificationVerificationError) {
      console.warn(`Apple 通知の検証に失敗しました: ${sanitizeError(error)}`);
      return NextResponse.json(
        { error: "通知の署名を検証できませんでした" },
        { status: 401 }
      );
    }
    if (
      error instanceof AppleNotificationConfigError ||
      error instanceof FirebaseAdminConfigError
    ) {
      console.error(`Apple 通知の設定エラー: ${sanitizeError(error)}`);
      return NextResponse.json(
        { error: "通知の受信設定が完了していません" },
        { status: 503 }
      );
    }
    if (error instanceof PurchaseVerificationError) {
      console.error(
        `Apple 通知の再検証に失敗しました: type=${notificationType}, ${sanitizeError(error)}`
      );
      return NextResponse.json(
        { error: "購入状態を確認できませんでした" },
        { status: error.statusCode >= 500 ? error.statusCode : 502 }
      );
    }
    console.error(
      `Apple 通知の処理エラー: type=${notificationType}, ${sanitizeError(error)}`
    );
    return NextResponse.json(
      { error: "通知を処理できませんでした" },
      { status: 500 }
    );
  }
}
