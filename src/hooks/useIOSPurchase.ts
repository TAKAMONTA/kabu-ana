"use client";

import { useState, useEffect, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { getApiUrl, getAuthHeaders } from "@/lib/utils/apiClient";
import { CapacitorHttp, Capacitor } from "@capacitor/core";

const PRODUCT_IDS = {
  ios: {
    monthly: {
      productIdentifier: "com.takaapps.kabunavi.Monthly",
    },
    yearly: {
      productIdentifier: "com.takaapps.kabunavi.Yearly",
    },
  },
  android: {
    monthly: {
      productIdentifier: "premium_monthly",
      planIdentifier: "premium_monthly",
    },
    yearly: {
      productIdentifier: "premium_yearly",
      planIdentifier: "premium_yearly",
    },
  },
} as const;

interface IOSProduct {
    identifier: string;
    title: string;
    description: string;
    priceString: string;
    price: number;
}

const getProductIds = () => {
    const platform = Capacitor.getPlatform();
    return platform === "android" ? PRODUCT_IDS.android : PRODUCT_IDS.ios;
};

/**
 * Native billing (StoreKit / Google Play Billing) を使った購入処理を管理するカスタムフック
 * @capgo/native-purchases プラグインを使用
 */
export function useIOSPurchase() {
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [products, setProducts] = useState<IOSProduct[]>([]);

    const initializeStore = useCallback(async () => {
        try {
            // 動的インポート（Web環境ではインポートしない）
            const { NativePurchases, PURCHASE_TYPE } = await import(
                "@capgo/native-purchases"
            );
            const productIds = getProductIds();

            // 課金サポートのチェック
            const { isBillingSupported } =
                await NativePurchases.isBillingSupported();
            if (!isBillingSupported) {
                console.warn("この端末では課金がサポートされていません");
                setError("この端末では課金機能がサポートされていません");
                return;
            }

            // サブスクリプション製品の取得
            const { products: storeProducts } =
                await NativePurchases.getProducts({
                    productIdentifiers: [
                        productIds.monthly.productIdentifier,
                        productIds.yearly.productIdentifier,
                    ],
                    productType: PURCHASE_TYPE.SUBS,
                });

            if (storeProducts && storeProducts.length > 0) {
                setProducts(
                    storeProducts.map((p: any) => ({
                        identifier: p.identifier,
                        title: p.title,
                        description: p.description,
                        priceString: p.priceString,
                        price: p.price,
                    }))
                );
            } else {
                console.warn("サブスクリプション製品が見つかりません。ストアの設定を確認してください。");
                setError("サブスクリプション製品の取得に失敗しました。しばらくしてからお試しください。");
            }

            setIsInitialized(true);
            console.log("ネイティブ課金初期化完了:", storeProducts);
        } catch (err: any) {
            console.error("ネイティブ課金初期化エラー:", err);
            setError("ストアの初期化に失敗しました。アプリを再起動してお試しください。");
        }
    }, []);

    // Native billing 製品の初期化
    useEffect(() => {
        // ネイティブプラットフォーム（iOS / Android）でのみ初期化する
        if (Capacitor.isNativePlatform() && ["ios", "android"].includes(Capacitor.getPlatform())) {
            initializeStore();
        }
    }, [initializeStore]);

    // 購入実行
    const purchaseProduct = useCallback(
        async (planType: "monthly" | "yearly" = "monthly") => {
            setIsLoading(true);
            setError(null);

            try {
                // ログインチェックを先に行う
                if (!auth?.currentUser) {
                    throw new Error("購入にはログインが必要です。先にログインしてください。");
                }

                const { NativePurchases, PURCHASE_TYPE } = await import(
                    "@capgo/native-purchases"
                );
                const productIds = getProductIds();

                const productConfig =
                    planType === "monthly"
                        ? productIds.monthly
                        : productIds.yearly;
                const productId = productConfig.productIdentifier;

                // StoreKit購入フローを開始
                const result = await NativePurchases.purchaseProduct({
                    productIdentifier: productId,
                    planIdentifier: "planIdentifier" in productConfig
                        ? productConfig.planIdentifier
                        : undefined,
                    productType: PURCHASE_TYPE.SUBS,
                    quantity: 1,
                });

                console.log("ネイティブ購入成功:", result);

                // Firebase Auth トークンを取得
                const idToken = await auth.currentUser!.getIdToken();

                // サーバー側でFirestoreに購入状態を保存
                const apiUrl = getApiUrl("/api/subscription/update");
                const transactionData = result as any;
                const response = await CapacitorHttp.post({
                    url: apiUrl,
                    headers: { "Content-Type": "application/json" },
                    data: {
                        idToken,
                        platform: Capacitor.getPlatform() === "android" ? "android" : "ios",
                        productId,
                        purchaseToken: transactionData.transactionId || "",
                        orderId: transactionData.transactionId || "",
                    },
                });

                if (response.status !== 200) {
                    const message =
                        response.data?.error ||
                        "購入は完了しましたが、購入検証に失敗しました。購入を復元してください。";
                    throw new Error(message);
                }

                setIsLoading(false);
                return true;
            } catch (err: any) {
                console.error("ネイティブ購入エラー:", err);

                // ユーザーキャンセルの場合はエラーメッセージを変更
                if (
                    err.message?.includes("cancel") ||
                    err.message?.includes("Cancel") ||
                    err.code === "USER_CANCELLED"
                ) {
                    setError(null); // キャンセルはエラーとして扱わない
                } else {
                    setError(err.message || "購入処理中にエラーが発生しました");
                }

                setIsLoading(false);
                return false;
            }
        },
        []
    );

    // 購入の復元
    const restorePurchases = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            if (!auth?.currentUser) {
                throw new Error("購入の復元にはログインが必要です。先にログインしてください。");
            }

            const { NativePurchases } = await import("@capgo/native-purchases");
            await NativePurchases.restorePurchases();

            const response = await CapacitorHttp.post({
                url: getApiUrl("/api/subscription/refresh"),
                headers: await getAuthHeaders(),
                data: {},
            });

            if (response.status !== 200) {
                throw new Error(
                    response.data?.error ||
                    "購入の復元は完了しましたが、購入状態の同期に失敗しました"
                );
            }

            console.log("購入の復元が完了しました");
            setIsLoading(false);
            return true;
        } catch (err: any) {
            console.error("購入復元エラー:", err);
            setError("購入の復元に失敗しました");
            setIsLoading(false);
            return false;
        }
    }, []);

    return {
        isLoading,
        isInitialized,
        error,
        products,
        purchaseProduct,
        restorePurchases,
    };
}
