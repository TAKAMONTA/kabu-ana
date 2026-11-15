"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { toFriendlyErrorMessage } from "@/lib/friendlyError";

const PURCHASE_ERROR_FALLBACK =
  "購入手続きを開始できませんでした。少し待ってからもう一度お試しください。";

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
        // エラー時に JSON 以外（HTML のエラーページ等）が返っても例外文を画面に出さない
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || PURCHASE_ERROR_FALLBACK);
      }

      const data = await response.json();
      
      if (!data.checkoutUrl) {
        throw new Error("チェックアウトURLが取得できませんでした");
      }

      // Lemon Squeezyのチェックアウトページに遷移
      window.location.href = data.checkoutUrl;
    } catch (err: unknown) {
      console.error("購入エラー:", err);
      setError(
        toFriendlyErrorMessage(
          err instanceof Error ? err.message : null,
          PURCHASE_ERROR_FALLBACK
        )
      );
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    startCheckout,
  };
}

