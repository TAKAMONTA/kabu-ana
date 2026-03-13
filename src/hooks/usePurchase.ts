"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";

/**
 * 購入処理を管理するカスタムフック
 */
export function usePurchase() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Lemon Squeezyのチェックアウトページに遷移
   * @param planType - "monthly" または "yearly"
   */
  const startCheckout = async (planType: "monthly" | "yearly" = "monthly") => {
    setIsLoading(true);
    setError(null);

    try {
      // Firebase Auth ID Tokenを取得（ログイン中の場合）
      let idToken: string | null = null;
      if (auth?.currentUser) {
        idToken = await auth.currentUser.getIdToken();
      }

      // チェックアウトセッションを作成
      const response = await fetch("/api/lemon-squeezy/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idToken,
          planType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "チェックアウトの作成に失敗しました");
      }

      const data = await response.json();
      
      if (!data.checkoutUrl) {
        throw new Error("チェックアウトURLが取得できませんでした");
      }

      // Lemon Squeezyのチェックアウトページに遷移
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      console.error("購入エラー:", err);
      setError(err.message || "購入処理中にエラーが発生しました");
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    startCheckout,
  };
}

