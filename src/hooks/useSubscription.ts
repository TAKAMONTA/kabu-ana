"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  isSubscriptionPremium,
  type Subscription,
} from "@/lib/types/subscription";
import { maybeRefreshNativeSubscription } from "@/lib/purchases/nativeRefresh";
import { useAuth } from "./useAuth";

/**
 * 購入状態を管理するカスタムフック
 */
export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !db) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    const subscriptionRef = doc(db, "subscriptions", user.uid);
    
    // リアルタイムで購入状態を監視
    const unsubscribe = onSnapshot(
      subscriptionRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setSubscription({
            userId: data.userId,
            status: data.status,
            platform: data.platform,
            productId: data.productId,
            purchaseToken: data.purchaseToken,
            orderId: data.orderId,
            purchaseDate: data.purchaseDate?.toDate() || new Date(data.purchaseDate),
            expiryDate: data.expiryDate?.toDate() || (data.expiryDate ? new Date(data.expiryDate) : undefined),
            isTrial: data.isTrial || false,
            createdAt: data.createdAt?.toDate() || new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate() || new Date(data.updatedAt),
            storeValidatedAt: data.storeValidation?.validatedAt
              ? new Date(data.storeValidation.validatedAt)
              : undefined,
          });
          setError(null);
        } else {
          setSubscription(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("購入状態の取得エラー:", err);
        setError("購入状態の取得に失敗しました");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // ネイティブ購入の定期的な再検証（起動時・アプリ復帰時）。
  // 更新・返金はサーバーに通知されないため、期限が近い（3日以内・過ぎた）か
  // 最終検証から24時間以上経っていれば /api/subscription/refresh を静かに呼ぶ。
  // 端末ごとに6時間に1回まで。ネイティブアプリ以外では何もしない。
  useEffect(() => {
    if (!user || !subscription) return;
    const uid = user.uid;
    const run = () => {
      void maybeRefreshNativeSubscription(uid, subscription);
    };
    run();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [user, subscription]);

  /**
   * 購入状態が有効かどうかを判定。
   * サーバー（/api/subscription/check 等）と同じ isSubscriptionPremium を使い、
   * Web版で解約予約した人も支払い済みの期限までプレミアムとして扱う。
   */
  const isActive = subscription?.status === "active" || subscription?.status === "trial";
  const hasExpired = subscription?.expiryDate
    ? new Date() > subscription.expiryDate
    : false;
  const isPremium = isSubscriptionPremium(subscription);

  return {
    subscription,
    loading,
    error,
    isPremium,
    isActive,
    hasExpired,
  };
}
