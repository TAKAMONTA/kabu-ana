"use client";

import { useState } from "react";
import Link from "next/link";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { usePurchase } from "@/hooks/usePurchase";
import { useIOSPurchase } from "@/hooks/useIOSPurchase";
import { isAndroidNative, isIOSNative } from "@/lib/utils/platformDetect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SubscriptionStatus() {
  const { user } = useAuth();
  const { subscription, loading, isPremium, hasExpired } = useSubscription();
  const {
    isLoading: isPurchasing,
    error: purchaseError,
    startCheckout,
  } = usePurchase();
  const {
    isLoading: isIOSPurchasing,
    error: iosError,
    purchaseProduct,
    restorePurchases,
  } = useIOSPurchase();
  const { deleteAccount } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isiOS = isIOSNative();
  const isAndroid = isAndroidNative();
  const usesNativeBilling = isiOS || isAndroid;
  const currentlyPurchasing = usesNativeBilling ? isIOSPurchasing : isPurchasing;
  const currentError = usesNativeBilling ? iosError : purchaseError;
  const billingAccountLabel = isAndroid
    ? "Google Playアカウント"
    : isiOS
      ? "Apple IDアカウント"
      : "決済サービス";
  const billingManagementLabel = isAndroid
    ? "Google Playの定期購入管理"
    : isiOS
      ? "設定アプリのApple IDサブスクリプション管理"
      : "決済サービスの管理画面";

  const handlePurchase = async () => {
    if (usesNativeBilling) {
      await purchaseProduct(selectedPlan);
    } else {
      startCheckout(selectedPlan);
    }
  };

  const getPlanButtonClass = (plan: "monthly" | "yearly") =>
    `flex-1 rounded-md border p-3 text-left text-sm transition-colors ${
      selectedPlan === plan
        ? "border-primary bg-primary/20 text-premium-foreground shadow-sm shadow-primary/20"
        : "border-primary/20 bg-premium text-premium-muted hover:border-primary/40 hover:bg-primary/10 hover:text-premium-foreground"
    }`;

  const handleDeleteAccount = async () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAccount = async () => {
    setIsDeleting(true);
    setShowDeleteConfirm(false);
    const result = await deleteAccount();
    if (!result.success) {
      alert(result.error || "アカウントの削除に失敗しました");
      setIsDeleting(false);
    }
  };

  // 共通のアカウント削除ボタンコンポーネント
  const DeleteAccountButton = () => (
    <div className="pt-4 border-t border-border mt-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDeleteAccount}
        disabled={isDeleting}
        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 text-[10px]"
      >
        {isDeleting ? "削除中..." : "アカウントを削除する"}
      </Button>
    </div>
  );

  // 共通の利用規約・プライバシーポリシーリンク
  const LegalLinks = () => (
    <div className="space-y-3 mt-4 border-t border-border pt-4">
      <div className="flex flex-col items-center gap-2">
        <p className="text-[10px] text-muted-foreground text-center leading-relaxed max-w-[300px]">
          プレミアム月額プラン: ¥700/月（1ヶ月ごとに自動更新）
          プレミアム年額プラン: ¥7,000/年（1年ごとに自動更新）
          サブスクリプションは期間終了の少なくとも24時間前に自動更新をオフにしない限り自動的に更新されます。
          お支払いは{billingAccountLabel}に請求されます。
          購入後の管理・キャンセルは{billingManagementLabel}から行えます。
        </p>
        <div className="flex items-center justify-center gap-3 text-xs">
          <Link
            href="/terms-of-use"
            className="text-primary hover:underline font-medium"
          >
            利用規約
          </Link>
          <span className="text-muted-foreground">|</span>
          <Link
            href="/privacy-policy"
            className="text-primary hover:underline font-medium"
          >
            プライバシーポリシー
          </Link>
          {isiOS && (
            <>
              <span className="text-muted-foreground">|</span>
              <a
                href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                EULA
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // 削除確認ダイアログ
  const DeleteConfirmDialog = () => {
    if (!showDeleteConfirm) return null;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">
              アカウント削除の確認
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              本当にアカウントを削除しますか？この操作は取り消せません。
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• すべてのアカウント情報が削除されます</li>
              <li>• サブスクリプション情報が削除されます</li>
              <li>• この操作は元に戻すことができません</li>
            </ul>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1"
              >
                キャンセル
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={confirmDeleteAccount}
                disabled={isDeleting}
                className="flex-1"
              >
                {isDeleting ? "削除中..." : "削除する"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>プレミアム機能</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            ログインしてプレミアム機能をご利用ください
          </p>
          <div className="mt-4 flex justify-center items-center gap-4 text-xs">
            <Link
              href="/terms-of-use"
              className="text-muted-foreground hover:text-primary underline"
            >
              利用規約
            </Link>
            <Link
              href="/privacy-policy"
              className="text-muted-foreground hover:text-primary underline"
            >
              プライバシーポリシー
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>購入状態を確認中...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (isPremium) {
    return (
      <>
        <DeleteConfirmDialog />
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="text-green-800 dark:text-green-200">
              プレミアム会員
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-green-700 dark:text-green-300">
                ✅ プレミアム機能をご利用いただけます
              </p>
              {subscription?.platform && (
                <p className="text-xs text-muted-foreground">
                  購入プラットフォーム:{" "}
                  {subscription.platform === "android"
                    ? "Android"
                    : subscription.platform === "web"
                      ? "Web"
                      : "iOS"}
                </p>
              )}
              {subscription?.expiryDate && (
                <p className="text-xs text-muted-foreground">
                  有効期限:{" "}
                  {new Date(subscription.expiryDate).toLocaleDateString(
                    "ja-JP"
                  )}
                </p>
              )}
              {subscription?.isTrial && (
                <p className="text-xs text-orange-600 dark:text-orange-300">
                  ⚠️ トライアル期間中です
                </p>
              )}
              <LegalLinks />
              <DeleteAccountButton />
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  if (hasExpired) {
    return (
      <>
        <DeleteConfirmDialog />
        <Card className="border-primary/30 bg-premium text-premium-foreground">
          <CardHeader>
            <CardTitle className="text-premium-foreground">
              有効期限切れ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-premium-muted">
                プレミアム機能の有効期限が切れています
              </p>
              {subscription?.expiryDate && (
                <p className="text-xs text-muted-foreground">
                  期限切れ日:{" "}
                  {new Date(subscription.expiryDate).toLocaleDateString(
                    "ja-JP"
                  )}
                </p>
              )}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    variant={selectedPlan === "monthly" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPlan("monthly")}
                    className={
                      selectedPlan === "monthly"
                        ? "flex-1 border-primary bg-primary text-primary-foreground"
                        : "flex-1 border-primary/30 bg-premium text-premium-muted hover:bg-primary/10"
                    }
                  >
                    月額プランを更新
                  </Button>
                  <Button
                    variant={selectedPlan === "yearly" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPlan("yearly")}
                    className={
                      selectedPlan === "yearly"
                        ? "flex-1 border-primary bg-primary text-primary-foreground"
                        : "flex-1 border-primary/30 bg-premium text-premium-muted hover:bg-primary/10"
                    }
                  >
                    年額プランを更新
                  </Button>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handlePurchase}
                  disabled={currentlyPurchasing}
                  className="w-full shadow-md shadow-primary/20"
                >
                  {currentlyPurchasing ? "処理中..." : "再購入する"}
                </Button>
                {usesNativeBilling && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={restorePurchases}
                    disabled={currentlyPurchasing}
                    className="w-full text-premium-muted hover:bg-primary/10 hover:text-premium-foreground"
                  >
                    購入を復元
                  </Button>
                )}
              </div>
              {currentError && (
                <p className="text-xs text-red-600 dark:text-red-300">
                  {currentError}
                </p>
              )}
              <LegalLinks />
              <DeleteAccountButton />
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <DeleteConfirmDialog />
      <Card className="border-primary/30 bg-premium text-premium-foreground shadow-md shadow-primary/10">
        <CardHeader>
          <CardTitle className="text-premium-foreground">
            プレミアム機能
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-premium-muted">
              プレミアム機能をご利用いただくには、購入が必要です
            </p>

            {/* 機能一覧 */}
            <ul className="list-disc space-y-1 pl-4 text-xs text-premium-muted">
              <li>無制限のAI株式分析</li>
              <li>詳細な財務評価レポート</li>
              <li>リアルタイムニュース分析</li>
              <li>広告なしの快適な利用体験</li>
            </ul>

            <div className="rounded-md border border-primary/25 bg-primary/10 p-3">
              <p className="text-xs text-premium-foreground">
                無料プランではAI機能を1日5回までご利用いただけます。プレミアムプランで無制限に！
              </p>
            </div>

            {/* プラン選択 */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPlan("monthly")}
                  className={getPlanButtonClass("monthly")}
                >
                  <div className="font-semibold text-xs">
                    プレミアム月額プラン
                  </div>
                  <div className="mt-1 text-lg font-bold">¥700</div>
                  <div className="text-[10px] text-premium-muted">
                    1ヶ月ごとに自動更新
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlan("yearly")}
                  className={getPlanButtonClass("yearly")}
                >
                  <div className="font-semibold text-xs">
                    プレミアム年額プラン
                  </div>
                  <div className="mt-1 text-lg font-bold">¥7,000</div>
                  <div className="text-[10px] text-premium-muted">
                    1年ごとに自動更新
                  </div>
                  <div className="mt-1 text-[10px] font-semibold text-primary">
                    約¥583/月（17%お得）
                  </div>
                </button>
              </div>

              <div className="pt-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handlePurchase}
                  disabled={currentlyPurchasing}
                  className="w-full py-6 text-base font-bold shadow-md shadow-primary/25"
                >
                  {currentlyPurchasing
                    ? "処理中..."
                    : `${selectedPlan === "monthly" ? "月額" : "年額"}プランで開始する`}
                </Button>
                {usesNativeBilling && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={restorePurchases}
                    disabled={currentlyPurchasing}
                    className="mt-2 w-full text-xs text-premium-muted hover:bg-primary/10 hover:text-premium-foreground"
                  >
                    購入を復元
                  </Button>
                )}
              </div>
            </div>

            {currentError && (
              <p className="text-xs text-red-600 dark:text-red-300 font-medium text-center">
                {currentError}
              </p>
            )}

            <LegalLinks />
            <DeleteAccountButton />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
