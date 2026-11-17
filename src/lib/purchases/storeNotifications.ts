import crypto from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { isSubscriptionPremium } from "@/lib/types/subscription";
import type { VerifiedNativePurchase } from "./nativePurchaseVerification";
import {
  PURCHASE_OWNERS_COLLECTION,
  purchaseOwnerKeyFor,
} from "./purchaseOwnership";

/**
 * ストアからのサーバー通知（App Store Server Notifications v2 / Google Play RTDN）を
 * subscriptions/{uid} に反映するための共通処理。
 *
 * 方針:
 * - 通知の中身は「何かが変わった」合図としてだけ使い、状態は必ずストアの API で
 *   再検証した結果（verifyNativePurchase）を書く
 * - 通知の所有者は purchase_owners/{sha256(platform:storeId)} で引く（未登録なら何もしない）
 * - 同じ通知の再送（Apple の notificationUUID / Pub/Sub の messageId）は
 *   store_notifications/{sha256(platform:eventId)} で重複排除する
 * - 購入ごとに最後に反映した通知の時刻（purchase_owners の lastNotificationAt）を持ち、
 *   それより古い通知は反映しない
 */
export const STORE_NOTIFICATIONS_COLLECTION = "store_notifications";

/** 重複排除の記録を残す期間（Firestore の TTL ポリシーを expireAt に設定すると自動削除される） */
const STORE_NOTIFICATION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

type NativePlatform = VerifiedNativePurchase["platform"];

export type StoreNotificationOutcome =
  /** subscriptions/{uid} に書き込んだ */
  | "applied"
  /** 同じ通知を処理済み */
  | "duplicate"
  /** 反映済みの通知より古い */
  | "stale"
  /** 処理中に所有者が変わった・解放された */
  | "owner_changed"
  /** 利用者の現在の購読は別の購入（Web 購読や別の購入系列）なので上書きしない */
  | "other_purchase"
  /** 所有記録がない（アプリから未登録、または退会済み） */
  | "no_owner"
  /** 所有者の Firebase Auth アカウントが存在しない */
  | "owner_deleted"
  /** ストアの再検証で購入を確認できなかった（恒久的なエラー） */
  | "unverifiable"
  /** 反映対象外の通知 */
  | "ignored";

export interface StoreNotificationEvent {
  platform: NativePlatform;
  /** Apple: notificationUUID / Google: Pub/Sub messageId */
  eventId: string;
  /** Apple: notificationType(/subtype) / Google: notificationType の番号 */
  type: string;
  /** 通知の発生時刻（Apple: signedDate / Google: eventTimeMillis）。epoch ms */
  eventAt: number;
}

export function storeNotificationEventKey(event: StoreNotificationEvent): string {
  return crypto
    .createHash("sha256")
    .update(`${event.platform}:${event.eventId}`)
    .digest("hex");
}

function eventRecord(
  event: StoreNotificationEvent,
  outcome: StoreNotificationOutcome,
  serverTimestamp: () => unknown,
  now: Date
): Record<string, unknown> {
  // uid や購入IDは保存しない（退会時の削除対象を増やさないため）
  return {
    platform: event.platform,
    type: event.type,
    eventAt: event.eventAt,
    outcome,
    processedAt: serverTimestamp(),
    expireAt: new Date(now.getTime() + STORE_NOTIFICATION_RETENTION_MS),
  };
}

/** 処理済みの通知かどうか（再送の早期判定。最終判定はトランザクション内で行う） */
export async function isStoreNotificationProcessed(
  db: Firestore,
  event: StoreNotificationEvent
): Promise<boolean> {
  const snapshot = await db
    .collection(STORE_NOTIFICATIONS_COLLECTION)
    .doc(storeNotificationEventKey(event))
    .get();
  return snapshot.exists;
}

/**
 * 反映しなかった通知を処理済みとして記録する（再送されても同じ判定を繰り返さない）。
 * ストアやネットワークの一時的な失敗では呼ばない（再送で再処理させるため）。
 */
export async function recordStoreNotification(
  db: Firestore,
  event: StoreNotificationEvent,
  outcome: StoreNotificationOutcome,
  serverTimestamp: () => unknown,
  now: Date = new Date()
): Promise<void> {
  await db
    .collection(STORE_NOTIFICATIONS_COLLECTION)
    .doc(storeNotificationEventKey(event))
    .set(eventRecord(event, outcome, serverTimestamp, now));
}

export interface PurchaseOwnerRecord {
  key: string;
  uid: string;
  productId?: string;
}

/** 所有記録を引く。uid が記録されていなければ null */
export async function findPurchaseOwner(
  db: Firestore,
  platform: NativePlatform,
  stableId: string
): Promise<PurchaseOwnerRecord | null> {
  const key = purchaseOwnerKeyFor(platform, stableId);
  const snapshot = await db.collection(PURCHASE_OWNERS_COLLECTION).doc(key).get();
  const data = snapshot.exists ? snapshot.data() : undefined;
  if (!data || typeof data.uid !== "string" || !data.uid) return null;
  return {
    key,
    uid: data.uid,
    productId: typeof data.productId === "string" ? data.productId : undefined,
  };
}

/**
 * 保存済みの購読が、通知の購入と同じ購入系列かどうか。
 * - iOS: orderId（= originalTransactionId）で比較
 * - Android: purchaseToken で比較。アップグレード等で発行された新しいトークンは
 *   linkedPurchaseToken（旧トークン）でつながる
 */
export function isSamePurchaseLineage(
  current: Record<string, unknown>,
  verified: VerifiedNativePurchase,
  linkedPurchaseToken?: string
): boolean {
  if (current.platform !== verified.platform) return false;
  if (verified.platform === "ios") {
    return (
      (typeof verified.originalTransactionId === "string" &&
        current.orderId === verified.originalTransactionId) ||
      current.purchaseToken === verified.purchaseToken
    );
  }
  return (
    current.purchaseToken === verified.purchaseToken ||
    (typeof linkedPurchaseToken === "string" &&
      linkedPurchaseToken !== "" &&
      current.purchaseToken === linkedPurchaseToken)
  );
}

/**
 * 通知の再検証結果で subscriptions/{uid} を上書きしてよいか。
 * - 購読がまだない → 書く
 * - 同じ購入系列 → 書く（更新・失効・返金のいずれも反映）
 * - 別の購入（Web 購読や古い購入系列）→ 通知側が有効で、今の購読が無効なときだけ書く
 *   （古い購入の失効通知で、今有効な別の購読を消さないため）
 */
export function shouldApplyStoreNotification(
  current: Record<string, unknown> | undefined,
  verified: VerifiedNativePurchase,
  linkedPurchaseToken: string | undefined,
  now: Date
): boolean {
  if (!current) return true;
  if (isSamePurchaseLineage(current, verified, linkedPurchaseToken)) return true;
  const incomingPremium = isSubscriptionPremium(
    {
      status: verified.status,
      platform: verified.platform,
      expiryDate: verified.expiryDate,
    },
    now
  );
  return incomingPremium && !isSubscriptionPremium(current, now);
}

export interface ApplyStoreNotificationParams {
  uid: string;
  /** purchase_owners のキー（purchaseOwnerKey(verified) と一致すること） */
  ownerKey: string;
  /**
   * 所有記録がなければ uid で作る（Android の linkedPurchaseToken で旧トークンの
   * 所有者が分かった新しいトークン用）。既に別の uid が所有していれば書かない。
   */
  createOwnerIfMissing?: boolean;
  event: StoreNotificationEvent;
  verified: VerifiedNativePurchase;
  linkedPurchaseToken?: string;
  /** 既存の subscriptions/{uid} が存在するかを受け取り、書き込むデータを返す */
  buildSubscriptionData: (subscriptionExists: boolean) => Record<string, unknown>;
  serverTimestamp: () => unknown;
  now?: Date;
}

/**
 * 重複・順序・所有者・上書き可否を1トランザクションで確認してから書き込む。
 * 反映しなかった場合も通知は処理済みとして記録する。
 */
export async function applyStoreNotification(
  db: Firestore,
  params: ApplyStoreNotificationParams
): Promise<StoreNotificationOutcome> {
  const now = params.now ?? new Date();
  const ownerRef = db.collection(PURCHASE_OWNERS_COLLECTION).doc(params.ownerKey);
  const subscriptionRef = db.collection("subscriptions").doc(params.uid);
  const eventRef = db
    .collection(STORE_NOTIFICATIONS_COLLECTION)
    .doc(storeNotificationEventKey(params.event));

  return db.runTransaction(async tx => {
    // 読み取りは書き込みより前にまとめる（Firestore トランザクションの制約）
    const [eventSnap, ownerSnap, subscriptionSnap] = await Promise.all([
      tx.get(eventRef),
      tx.get(ownerRef),
      tx.get(subscriptionRef),
    ]);
    if (eventSnap.exists) return "duplicate";

    const finish = (outcome: StoreNotificationOutcome) => {
      tx.set(
        eventRef,
        eventRecord(params.event, outcome, params.serverTimestamp, now)
      );
      return outcome;
    };

    const owner = ownerSnap.exists ? ownerSnap.data() : undefined;
    const ownerUid = typeof owner?.uid === "string" ? owner.uid : undefined;
    if (ownerUid !== params.uid && !(params.createOwnerIfMissing && !ownerUid)) {
      return finish("owner_changed");
    }

    const lastNotificationAt = owner?.lastNotificationAt;
    if (
      typeof lastNotificationAt === "number" &&
      params.event.eventAt < lastNotificationAt
    ) {
      return finish("stale");
    }

    const current = subscriptionSnap.exists ? subscriptionSnap.data() : undefined;
    if (
      !shouldApplyStoreNotification(
        current,
        params.verified,
        params.linkedPurchaseToken,
        now
      )
    ) {
      return finish("other_purchase");
    }

    tx.set(
      subscriptionRef,
      params.buildSubscriptionData(subscriptionSnap.exists),
      { merge: true }
    );
    tx.set(
      ownerRef,
      ownerUid
        ? {
            lastNotificationAt: params.event.eventAt,
            updatedAt: params.serverTimestamp(),
          }
        : {
            uid: params.uid,
            platform: params.verified.platform,
            productId: params.verified.productId,
            lastNotificationAt: params.event.eventAt,
            createdAt: params.serverTimestamp(),
            updatedAt: params.serverTimestamp(),
          },
      { merge: true }
    );
    return finish("applied");
  });
}
