"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { getApiUrl } from "@/lib/utils/apiClient";
import { CapacitorHttp } from "@capacitor/core";

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
      let idToken: string | null = null;
      if (auth?.currentUser) {
        idToken = await auth.currentUser.getIdToken();
      }

      const response = await CapacitorHttp.post({
        url: getApiUrl("/api/lemon-squeezy/checkout"),
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          idToken,
          planType,
        },
      });

      if (response.status !== 200) {
        const errorData =
          typeof response.data === "object" && response.data !== null
            ? response.data
            : {};
        throw new Error(
          (errorData as { error?: string }).error ||
            "チェックアウトの作成に失敗しました"
        );
      }

      const data =
        typeof response.data === "string"
          ? JSON.parse(response.data)
          : response.data;

      if (!data.checkoutUrl) {
        throw new Error("チェックアウトURLが取得できませんでした");
      }

      window.location.href = data.checkoutUrl;
    } catch (err: unknown) {
      console.error("購入エラー:", err);
      setError(
        err instanceof Error ? err.message : "購入処理中にエラーが発生しました"
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

