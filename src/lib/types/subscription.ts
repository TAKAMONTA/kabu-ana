/**
 * 購入状態の型定義
 */

export type SubscriptionPlatform = "android" | "web" | "ios";

export type SubscriptionStatus = 
  | "active"      // 有効
  | "expired"     // 期限切れ
  | "cancelled"   // キャンセル済み
  | "pending"     // 処理中
  | "trial";      // トライアル中

export interface Subscription {
  userId: string;                    // Firebase Auth UID
  status: SubscriptionStatus;        // 購入状態
  platform: SubscriptionPlatform;    // 購入プラットフォーム
  productId: string;                 // 商品ID（Google Play / Lemon Squeezy）
  purchaseToken?: string;             // 購入トークン（Google Play用）
  orderId?: string;                   // 注文ID（Lemon Squeezy用）
  purchaseDate: Date;                 // 購入日時
  expiryDate?: Date;                  // 有効期限（サブスクリプションの場合）
  isTrial: boolean;                   // トライアルかどうか
  createdAt: Date;                    // レコード作成日時
  updatedAt: Date;                    // 最終更新日時
  storeValidatedAt?: Date;            // ストアでの最終検証日時（ネイティブ購入のみ）
}

/**
 * Firestoreに保存する際の形式
 */
export interface SubscriptionDocument {
  userId: string;
  status: SubscriptionStatus;
  platform: SubscriptionPlatform;
  productId: string;
  purchaseToken?: string;
  orderId?: string;
  purchaseDate: any; // Firestore Timestamp or Date
  expiryDate?: any; // Firestore Timestamp or Date
  isTrial: boolean;
  createdAt: any; // Firestore Timestamp or Date
  updatedAt: any; // Firestore Timestamp or Date
}

/**
 * プレミアム判定に必要な最小限のフィールド。
 * Firestore の生データ（expiryDate が Timestamp）と、変換済みの Subscription
 * （expiryDate が Date）のどちらも受け取れるように unknown で受ける。
 */
export interface SubscriptionEntitlementInput {
  status?: unknown;
  platform?: unknown;
  expiryDate?: unknown;
}

/** Web の継続中の購読に与える、更新日（renews_at）からの猶予 */
export const WEB_RENEWAL_GRACE_MS = 48 * 60 * 60 * 1000;

/** 解釈できない値を表す番兵（「期限なし」と区別するため） */
const INVALID_DATE = Symbol("invalid-date");

/**
 * expiryDate を Date に正規化する。
 * - null/undefined → null（期限なし）
 * - Firestore Timestamp（toDate を持つ）/ Date / ISO文字列 / epoch ms → Date
 * - それ以外・不正な日付 → INVALID_DATE
 */
function normalizeExpiry(value: unknown): Date | null | typeof INVALID_DATE {
  if (value === null || value === undefined) return null;
  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (
    typeof value === "object" &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    try {
      const converted = (value as { toDate: () => unknown }).toDate();
      date = converted instanceof Date ? converted : null;
    } catch {
      date = null;
    }
  } else if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  }
  if (!date || !Number.isFinite(date.getTime())) return INVALID_DATE;
  return date;
}

/**
 * サーバー側のプレミアム判定（全エンドポイント共通）。
 *
 * - status が active / trial: 期限なし、または期限が未来ならプレミアム
 *   （Web は renews_at から 48 時間の猶予。更新通知の到着待ちで失効させない）
 * - 返金済みの Web 購読は status を expired にして保存する（＝無効）
 * - status が cancelled かつ Web（Lemon Squeezy）購入: 期限（ends_at）が未来なら
 *   プレミアム。Lemon Squeezy の cancelled は「自動更新の停止」で、支払い済みの
 *   期間が終わるまでは利用できる（grace period）ため。
 * - ネイティブ（ios / android）の cancelled は返金・取り消し（revoke）を表すので
 *   期限に関係なく無効。ストア側で解約しても期限まで使える状態は、検証時に
 *   active として保存している（nativePurchaseVerification.ts）。
 * - 期限が解釈できない値なら fail-closed（無効）
 */
export function isSubscriptionPremium(
  subscription: SubscriptionEntitlementInput | null | undefined,
  now: Date = new Date()
): boolean {
  if (!subscription) return false;
  const expiry = normalizeExpiry(subscription.expiryDate);
  if (expiry === INVALID_DATE) return false;

  const status = subscription.status;
  const isNative =
    subscription.platform === "ios" || subscription.platform === "android";
  if (status === "active" || status === "trial") {
    if (expiry === null) return true;
    // Web（Lemon Squeezy）の継続中の購読は expiryDate = renews_at（次回更新日）。
    // 更新の subscription_updated が届くまでの間に失効しないよう 48 時間の猶予を置く。
    // ネイティブはストアの期限そのもの（猶予期間はストア側の状態で表す）なので猶予なし。
    const grace = isNative ? 0 : WEB_RENEWAL_GRACE_MS;
    return now.getTime() < expiry.getTime() + grace;
  }

  if (status === "cancelled") {
    if (isNative) return false;
    // 解約済み（ends_at まで）には猶予を足さない
    return expiry !== null && now.getTime() < expiry.getTime();
  }

  return false;
}

