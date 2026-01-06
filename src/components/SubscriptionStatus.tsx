"use client";

import { useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { usePurchase } from "@/hooks/usePurchase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SubscriptionStatus() {
  const { user } = useAuth();
  const { subscription, loading, isPremium, hasExpired } = useSubscription();
  const { isLoading: isPurchasing, error: purchaseError, startCheckout } = usePurchase();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("monthly");

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
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hasExpired) {
    return (
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
                onClick={() => startCheckout(selectedPlan)}
                disabled={isPurchasing}
                className="w-full"
              >
                {isPurchasing ? "処理中..." : "再購入する"}
              </Button>
            </div>
            {purchaseError && (
              <p className="text-xs text-red-600">{purchaseError}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
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
          
          {/* プラン選択 */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedPlan("monthly")}
                className={`flex-1 rounded-md border p-3 text-sm transition-colors ${
                  selectedPlan === "monthly"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                <div className="font-semibold">月額プラン</div>
                <div className="mt-1 text-lg font-bold">¥700</div>
                <div className="text-xs text-muted-foreground">/月</div>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPlan("yearly")}
                className={`flex-1 rounded-md border p-3 text-sm transition-colors ${
                  selectedPlan === "yearly"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                <div className="font-semibold">年額プラン</div>
                <div className="mt-1 text-lg font-bold">¥7,000</div>
                <div className="text-xs text-muted-foreground">/年</div>
                <div className="mt-1 text-xs font-semibold text-green-600">
                  約¥583/月（17%お得）
                </div>
              </button>
            </div>
            
            <Button 
              variant="default" 
              size="sm"
              onClick={() => startCheckout(selectedPlan)}
              disabled={isPurchasing}
              className="w-full"
            >
              {isPurchasing ? "処理中..." : `${selectedPlan === "monthly" ? "月額" : "年額"}プランを購入`}
            </Button>
          </div>
          
          {purchaseError && (
            <p className="text-xs text-red-600">{purchaseError}</p>
          )}
          
          <p className="text-[10px] text-muted-foreground text-center">
            安全な決済 • いつでもキャンセル可能
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
