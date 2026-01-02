"use client";

import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, Crown, CheckCircle } from "lucide-react";

export function SubscriptionStatus() {
  const { user } = useAuth();
  const { subscription, loading, isPremium, hasExpired } = useSubscription();

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            プレミアム機能
          </CardTitle>
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
      <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <CardHeader>
          <CardTitle className="text-green-800 flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            プレミアム会員
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">プレミアム機能が有効です</span>
            </div>
            
            <ul className="text-sm text-green-700 space-y-1 ml-7">
              <li>✨ 無制限のAI株式分析</li>
              <li>✨ 詳細な財務評価レポート</li>
              <li>✨ リアルタイムニュース分析</li>
              <li>✨ 広告なしの快適な利用体験</li>
            </ul>

            {subscription?.platform && (
              <p className="text-xs text-muted-foreground ml-7">
                購入元: {subscription.platform === "android" ? "Android アプリ" : subscription.platform === "ios" ? "iOS アプリ" : "Web"}
              </p>
            )}
            {subscription?.expiryDate && (
              <p className="text-xs text-muted-foreground ml-7">
                有効期限: {new Date(subscription.expiryDate).toLocaleDateString("ja-JP")}
              </p>
            )}
            {subscription?.isTrial && (
              <p className="text-xs text-orange-600 ml-7">
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
          <CardTitle className="text-orange-800 flex items-center gap-2">
            <Crown className="h-5 w-5 text-orange-500" />
            有効期限切れ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-orange-700">
              プレミアム機能の有効期限が切れています
            </p>
            {subscription?.expiryDate && (
              <p className="text-xs text-muted-foreground">
                期限切れ日: {new Date(subscription.expiryDate).toLocaleDateString("ja-JP")}
              </p>
            )}
            <div className="p-3 bg-white rounded-lg border border-orange-200">
              <div className="flex items-center gap-2 text-orange-800 mb-2">
                <Smartphone className="h-5 w-5" />
                <span className="font-medium">アプリで再購入</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Android または iOS アプリから再購入すると、自動的に同期されます
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 未購入ユーザー
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" />
          プレミアム機能
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            プレミアム機能をご利用いただくには、アプリからの購入が必要です
          </p>
          
          {/* 機能一覧 */}
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>✨ 無制限のAI株式分析</li>
            <li>✨ 詳細な財務評価レポート</li>
            <li>✨ リアルタイムニュース分析</li>
            <li>✨ 広告なしの快適な利用体験</li>
          </ul>
          
          {/* アプリへの誘導 */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Smartphone className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-blue-900">アプリで購入</p>
                <p className="text-xs text-blue-700">
                  Android または iOS アプリからプレミアムを購入してください
                </p>
              </div>
            </div>
            
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href="https://play.google.com/store/apps/details?id=com.kabuana.app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-3 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                </svg>
                Google Play
              </a>
              <a
                href="https://apps.apple.com/app/id0000000000"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-3 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.09,16.67C20.06,16.74 19.67,18.11 18.71,19.5M13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z" />
                </svg>
                App Store
              </a>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground text-center">
            アプリで購入後、同じアカウントでログインすると自動的に同期されます
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
