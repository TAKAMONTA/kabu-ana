"use client";

import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { usePurchase } from "@/hooks/usePurchase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SubscriptionStatus() {
  const { user } = useAuth();
  const { subscription, loading, isPremium, hasExpired } = useSubscription();
  const { isLoading: isPurchasing, error: purchaseError, startCheckout } = usePurchase();

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
            <Button 
              variant="outline" 
              size="sm"
              onClick={startCheckout}
              disabled={isPurchasing}
            >
              {isPurchasing ? "処理中..." : "再購入する"}
            </Button>
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
          
          <Button 
            variant="default" 
            size="sm"
            onClick={startCheckout}
            disabled={isPurchasing}
            className="w-full"
          >
            {isPurchasing ? "処理中..." : "プレミアムプランを購入"}
          </Button>
          
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
