"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Subscription } from "@/lib/types/subscription";
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

  /**
   * 購入状態が有効かどうかを判定
   */
  const isActive = subscription?.status === "active" || subscription?.status === "trial";
  const hasExpired = subscription?.expiryDate 
    ? new Date() > subscription.expiryDate 
    : false;
  const isPremium = isActive && !hasExpired;

  return {
    subscription,
    loading,
    error,
    isPremium,
    isActive,
    hasExpired,
  };
}
