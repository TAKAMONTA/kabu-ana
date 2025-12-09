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
 * 購入状態をチェックするためのヘルパー関数
 */
export function isSubscriptionActive(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  
  if (subscription.status !== "active" && subscription.status !== "trial") {
    return false;
  }
  
  // 有効期限がある場合、現在日時と比較
  if (subscription.expiryDate) {
    return new Date() < subscription.expiryDate;
  }
  
  // 有効期限がない場合は、statusがactiveまたはtrialなら有効
  return true;
}

