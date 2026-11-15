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
  if (status === "active" || status === "trial") {
    return expiry === null || now.getTime() < expiry.getTime();
  }

  if (status === "cancelled") {
    const isNative =
      subscription.platform === "ios" || subscription.platform === "android";
    if (isNative) return false;
    return expiry !== null && now.getTime() < expiry.getTime();
  }

  return false;
}

