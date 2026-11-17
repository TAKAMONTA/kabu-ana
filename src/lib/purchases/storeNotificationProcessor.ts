import type { Firestore } from "firebase-admin/firestore";
import { maskId, sanitizeError } from "@/lib/utils/logSanitizer";
import {
  buildSubscriptionDocumentFromVerification,
  parseNativePurchaseUpdateRequest,
  PurchaseVerificationError,
  verifyNativePurchase,
  type VerifiedNativePurchase,
} from "./nativePurchaseVerification";
import { authUserExists, purchaseOwnerKey } from "./purchaseOwnership";
import {
  applyStoreNotification,
  findPurchaseOwner,
  recordStoreNotification,
  type PurchaseOwnerRecord,
  type StoreNotificationEvent,
  type StoreNotificationOutcome,
} from "./storeNotifications";

export interface StoreNotificationDeps {
  db: Firestore;
  getUser: (uid: string) => Promise<unknown>;
  serverTimestamp: () => unknown;
  verify?: typeof verifyNativePurchase;
  now?: () => Date;
}

export interface ReverifyInput {
  event: StoreNotificationEvent;
  platform: VerifiedNativePurchase["platform"];
  /** 再検証に使う商品ID（許可リスト内であること） */
  productId: string;
  /** iOS: 通知の transactionId / Android: purchaseToken */
  purchaseToken: string;
  /** 購入系列の不変ID（iOS: originalTransactionId / Android: purchaseToken） */
  stableId: string;
  /**
   * 所有記録。null は Android の新しいトークンで、再検証結果の
   * linkedPurchaseToken（旧トークン）の所有者に引き継げる場合のみ使う
   */
  owner: PurchaseOwnerRecord | null;
}

function linkedPurchaseTokenOf(verified: VerifiedNativePurchase): string | undefined {
  if (verified.platform !== "android") return undefined;
  const raw = verified.raw as { linkedPurchaseToken?: unknown } | null;
  return typeof raw?.linkedPurchaseToken === "string" && raw.linkedPurchaseToken
    ? raw.linkedPurchaseToken
    : undefined;
}

/**
 * ストア通知の購入をストア API で再検証し、所有者の subscriptions/{uid} に反映する。
 * - ストア・設定の一時的な失敗（PurchaseVerificationError の 5xx など）は投げる
 *   （ルートが 5xx を返し、ストア側の再送で再処理させる）
 * - 恒久的に反映できないもの（所有者なし・退会済み・購入が見つからない等）は
 *   処理済みとして記録して結果を返す
 */
export async function reverifyAndApplyStoreNotification(
  deps: StoreNotificationDeps,
  input: ReverifyInput
): Promise<StoreNotificationOutcome> {
  const now = deps.now?.() ?? new Date();
  const verify = deps.verify ?? verifyNativePurchase;
  const ownerExists = authUserExists({ getUser: deps.getUser });
  const record = async (outcome: StoreNotificationOutcome) => {
    await recordStoreNotification(
      deps.db,
      input.event,
      outcome,
      deps.serverTimestamp,
      now
    );
    return outcome;
  };

  if (input.owner && !(await ownerExists(input.owner.uid))) {
    return record("owner_deleted");
  }

  let request: ReturnType<typeof parseNativePurchaseUpdateRequest>;
  let verified: VerifiedNativePurchase;
  try {
    // idToken はルート側の通知検証で代替済み（parse の必須項目を満たすための値）
    request = parseNativePurchaseUpdateRequest({
      idToken: "store-notification",
      platform: input.platform,
      productId: input.productId,
      purchaseToken: input.purchaseToken,
    });
    verified = await verify(request);
  } catch (error) {
    if (error instanceof PurchaseVerificationError && error.statusCode < 500) {
      console.warn(
        `ストア通知の再検証で購入を確認できませんでした: platform=${input.platform}, type=${input.event.type}, detail=${sanitizeError(error, [input.purchaseToken, input.stableId])}`
      );
      return record("unverifiable");
    }
    throw error;
  }

  const verifiedStableId =
    verified.platform === "ios"
      ? verified.originalTransactionId
      : verified.purchaseToken;
  if (verifiedStableId !== input.stableId) {
    console.warn(
      `ストア通知の購入IDと再検証結果が一致しません: platform=${input.platform}, type=${input.event.type}`
    );
    return record("unverifiable");
  }

  const linkedPurchaseToken = linkedPurchaseTokenOf(verified);
  let owner = input.owner;
  let createOwnerIfMissing = false;
  if (!owner) {
    if (!linkedPurchaseToken) return record("no_owner");
    const linkedOwner = await findPurchaseOwner(
      deps.db,
      "android",
      linkedPurchaseToken
    );
    if (!linkedOwner) return record("no_owner");
    if (!(await ownerExists(linkedOwner.uid))) return record("owner_deleted");
    owner = { key: purchaseOwnerKey(verified), uid: linkedOwner.uid };
    createOwnerIfMissing = true;
  }

  const ownerKey = purchaseOwnerKey(verified);
  if (ownerKey !== owner.key) {
    // stableId の一致を確認済みなので通常は起きない
    console.warn(
      `ストア通知の所有記録キーが一致しません: platform=${input.platform}, user=${maskId(owner.uid)}`
    );
    return record("unverifiable");
  }

  const uid = owner.uid;
  const outcome = await applyStoreNotification(deps.db, {
    uid,
    ownerKey,
    createOwnerIfMissing,
    event: input.event,
    verified,
    linkedPurchaseToken,
    serverTimestamp: deps.serverTimestamp,
    now,
    buildSubscriptionData: subscriptionExists => ({
      ...buildSubscriptionDocumentFromVerification(uid, request, verified),
      lastStoreNotification: {
        type: input.event.type,
        eventAt: input.event.eventAt,
      },
      updatedAt: deps.serverTimestamp(),
      ...(subscriptionExists ? {} : { createdAt: deps.serverTimestamp() }),
    }),
  });
  console.info(
    `ストア通知を処理しました: platform=${input.platform}, type=${input.event.type}, outcome=${outcome}, user=${maskId(uid)}, status=${verified.status}`
  );
  return outcome;
}
