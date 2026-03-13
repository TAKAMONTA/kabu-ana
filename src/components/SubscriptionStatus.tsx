"use client";

import { useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { usePurchase } from "@/hooks/usePurchase";
import { useIOSPurchase } from "@/hooks/useIOSPurchase";
import { isIOSNative } from "@/lib/utils/platformDetect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SubscriptionStatus() {
  const { user } = useAuth();
  const { subscription, loading, isPremium, hasExpired } = useSubscription();
  const { isLoading: isPurchasing, error: purchaseError, startCheckout } = usePurchase();
  const {
    isLoading: isIOSPurchasing,
    error: iosError,
    purchaseProduct,
    restorePurchases,
  } = useIOSPurchase();
  const { deleteAccount } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("monthly");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isiOS = isIOSNative();
  const currentlyPurchasing = isiOS ? isIOSPurchasing : isPurchasing;
  const currentError = isiOS ? iosError : purchaseError;

  const handlePurchase = async () => {
    if (isiOS) {
      await purchaseProduct(selectedPlan);
    } else {
      startCheckout(selectedPlan);
    }
  };

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
    <div className="space-y-2 mt-3">
      <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
        サブスクリプションは期間終了の24時間前までにキャンセルしない限り自動更新されます。
        お支払いはApple IDアカウントに請求されます。
        サブスクリプションの管理・キャンセルは、購入後にApple IDのアカウント設定から行えます。
      </p>
      <div className="flex items-center justify-center gap-2 text-[10px]">
        <a href={isiOS ? "https://kabu-ana.com/terms-of-use" : "/terms-of-use"} className="text-primary hover:underline" target={isiOS ? "_blank" : undefined} rel={isiOS ? "noopener noreferrer" : undefined}>
          利用規約
        </a>
        <span className="text-muted-foreground">|</span>
        <a href={isiOS ? "https://kabu-ana.com/privacy-policy" : "/privacy-policy"} className="text-primary hover:underline" target={isiOS ? "_blank" : undefined} rel={isiOS ? "noopener noreferrer" : undefined}>
          プライバシーポリシー
        </a>
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
            <CardTitle className="text-lg text-destructive">アカウント削除の確認</CardTitle>
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
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800">プレミアム会員</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-green-700">
                ✅ プレミアム機能をご利用いただけます
              </p>
              {subscription?.platform && (
                <p className="text-xs text-muted-foreground">
                  購入プラットフォーム: {subscription.platform === "android" ? "Android" : subscription.platform === "web" ? "Web" : "iOS"}
                </p>
              )}
              {subscription?.expiryDate && (
                <p className="text-xs text-muted-foreground">
                  有効期限: {new Date(subscription.expiryDate).toLocaleDateString("ja-JP")}
                </p>
              )}
              {subscription?.isTrial && (
                <p className="text-xs text-orange-600">
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
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800">有効期限切れ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-orange-700">
                プレミアム機能の有効期限が切れています
              </p>
              {subscription?.expiryDate && (
                <p className="text-xs text-muted-foreground">
                  期限切れ日: {new Date(subscription.expiryDate).toLocaleDateString("ja-JP")}
                </p>
              )}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    variant={selectedPlan === "monthly" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPlan("monthly")}
                    className="flex-1"
                  >
                    月額 ¥700
                  </Button>
                  <Button
                    variant={selectedPlan === "yearly" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPlan("yearly")}
                    className="flex-1"
                  >
                    年額 ¥7,000
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePurchase}
                  disabled={currentlyPurchasing}
                  className="w-full"
                >
                  {currentlyPurchasing ? "処理中..." : "再購入する"}
                </Button>
                {isiOS && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={restorePurchases}
                    disabled={currentlyPurchasing}
                    className="w-full"
                  >
                    購入を復元
                  </Button>
                )}
              </div>
              {currentError && (
                <p className="text-xs text-red-600">{currentError}</p>
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
      <Card>
        <CardHeader>
          <CardTitle>プレミアム機能</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              プレミアム機能をご利用いただくには、購入が必要です
            </p>

            {/* 機能一覧 */}
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✨ 無制限のAI株式分析</li>
              <li>✨ 詳細な財務評価レポート</li>
              <li>✨ リアルタイムニュース分析</li>
              <li>✨ 広告なしの快適な利用体験</li>
            </ul>

            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-xs text-blue-700">
                💡 無料プランではAI機能を1日5回までご利用いただけます。プレミアムプランで無制限に！
              </p>
            </div>

            {/* プラン選択 */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPlan("monthly")}
                  className={`flex-1 rounded-md border p-3 text-sm transition-colors ${selectedPlan === "monthly"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:bg-muted"
                    }`}
                >
                  <div className="font-semibold">プレミアム月額プラン</div>
                  <div className="mt-1 text-lg font-bold">¥700</div>
                  <div className="text-xs text-muted-foreground">1ヶ月ごとに自動更新</div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlan("yearly")}
                  className={`flex-1 rounded-md border p-3 text-sm transition-colors ${selectedPlan === "yearly"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:bg-muted"
                    }`}
                >
                  <div className="font-semibold">プレミアム年額プラン</div>
                  <div className="mt-1 text-lg font-bold">¥7,000</div>
                  <div className="text-xs text-muted-foreground">1年ごとに自動更新</div>
                  <div className="mt-1 text-xs font-semibold text-green-600">
                    約¥583/月（17%お得）
                  </div>
                </button>
              </div>

              <Button
                variant="default"
                size="sm"
                onClick={handlePurchase}
                disabled={currentlyPurchasing}
                className="w-full"
              >
                {currentlyPurchasing ? "処理中..." : `${selectedPlan === "monthly" ? "月額" : "年額"}プランを購入`}
              </Button>
              {isiOS && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={restorePurchases}
                  disabled={currentlyPurchasing}
                  className="w-full mt-1"
                >
                  購入を復元
                </Button>
              )}
            </div>

            {currentError && (
              <p className="text-xs text-red-600">{currentError}</p>
            )}

            <LegalLinks />
            <DeleteAccountButton />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
