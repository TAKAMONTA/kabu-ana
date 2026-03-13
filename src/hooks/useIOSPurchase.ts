"use client";

import { useState, useEffect, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { getApiUrl } from "@/lib/utils/apiClient";
import { CapacitorHttp, Capacitor } from "@capacitor/core";

// App Store Connectで設定した実際の製品ID
const IOS_PRODUCT_IDS = {
    monthly: "com.takaapps.kabunavi.Monthly",
    yearly: "com.takaapps.kabunavi.Yearly",
} as const;

interface IOSProduct {
    identifier: string;
    title: string;
    description: string;
    priceString: string;
    price: number;
}

/**
 * iOS StoreKit (IAP) を使った購入処理を管理するカスタムフック
 * @capgo/native-purchases プラグインを使用
 */
export function useIOSPurchase() {
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [products, setProducts] = useState<IOSProduct[]>([]);

    // StoreKit製品の初期化
    useEffect(() => {
        // ネイティブプラットフォーム（iOS）でのみ初期化する
        if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
            initializeStore();
        }
    }, []);

    const initializeStore = async () => {
        try {
            // 動的インポート（Web環境ではインポートしない）
            const { NativePurchases, PURCHASE_TYPE } = await import(
                "@capgo/native-purchases"
            );

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
                        IOS_PRODUCT_IDS.monthly,
                        IOS_PRODUCT_IDS.yearly,
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
                console.warn("サブスクリプション製品が見つかりません。App Store Connectの設定を確認してください。");
                setError("サブスクリプション製品の取得に失敗しました。しばらくしてからお試しください。");
            }

            setIsInitialized(true);
            console.log("iOS StoreKit初期化完了:", storeProducts);
        } catch (err: any) {
            console.error("StoreKit初期化エラー:", err);
            setError("ストアの初期化に失敗しました。アプリを再起動してお試しください。");
        }
    };

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

                const productId =
                    planType === "monthly"
                        ? IOS_PRODUCT_IDS.monthly
                        : IOS_PRODUCT_IDS.yearly;

                // StoreKit購入フローを開始
                const result = await NativePurchases.purchaseProduct({
                    productIdentifier: productId,
                    productType: PURCHASE_TYPE.SUBS,
                    quantity: 1,
                });

                console.log("iOS購入成功:", result);

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
                        status: "active",
                        platform: "ios",
                        productId,
                        purchaseToken: transactionData.transactionId || "",
                        orderId: transactionData.transactionId || "",
                        expiryDate: transactionData.expirationDate || undefined,
                        isTrial: transactionData.isTrialPeriod || false,
                    },
                });

                if (response.status !== 200) {
                    console.error("サーバー更新エラー:", response.data);
                    // 購入自体はApple側で成功しているのでエラーは警告に留める
                    console.warn(
                        "購入はAppleで処理されましたが、サーバーとの同期に失敗しました"
                    );
                }

                setIsLoading(false);
                return true;
            } catch (err: any) {
                console.error("iOS購入エラー:", err);

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
            const { NativePurchases } = await import("@capgo/native-purchases");
            await NativePurchases.restorePurchases();
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

