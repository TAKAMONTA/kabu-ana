import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getAdminApp, FirebaseAdminConfigError } from "@/lib/firebase/admin";
import { sanitizeError } from "@/lib/utils/logSanitizer";
import type { Subscription } from "@/lib/types/subscription";

export const dynamic =
  process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

/**
 * 購入状態を確認するAPI
 * GET /api/subscription/check
 *
 * 認証方法（優先順）:
 * - Authorization: Bearer <idToken> ヘッダー（推奨）
 * - クエリパラメータ idToken（非推奨・後方互換のため維持。旧バージョンのモバイルアプリ対応）
 */
export async function GET(request: NextRequest) {
  // 静的エクスポート時はビルドエラーを防ぐためダミーを返す
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }

  try {
    const authHeader = request.headers.get("Authorization");
    const headerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const queryToken = request.nextUrl.searchParams.get("idToken");
    const idToken = headerToken || queryToken;

    if (!headerToken && queryToken) {
      console.warn("subscription/check: deprecated query-param idToken used");
    }

    if (!idToken) {
      return NextResponse.json({ error: "idTokenが必要です" }, { status: 400 });
    }

    // Firebase Admin SDKの初期化
    const app = getAdminApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Firebase Auth ID Tokenの検証
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
      console.error("ID Token検証エラー:", error);
      return NextResponse.json(
        { error: "認証に失敗しました" },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;

    // Firestoreから購入状態を取得
    const subscriptionRef = db.collection("subscriptions").doc(userId);
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      return NextResponse.json({
        hasSubscription: false,
        subscription: null,
        isPremium: false,
      });
    }

    const data = subscriptionDoc.data()!;
    const subscription: Subscription = {
      userId: data.userId,
      status: data.status,
      platform: data.platform,
      productId: data.productId,
      purchaseToken: data.purchaseToken,
      orderId: data.orderId,
      purchaseDate: data.purchaseDate?.toDate() || new Date(data.purchaseDate),
      expiryDate:
        data.expiryDate?.toDate() ||
        (data.expiryDate ? new Date(data.expiryDate) : undefined),
      isTrial: data.isTrial || false,
      createdAt: data.createdAt?.toDate() || new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate() || new Date(data.updatedAt),
    };

    // 有効期限をチェック
    const isActive =
      subscription.status === "active" || subscription.status === "trial";
    const hasExpired = subscription.expiryDate
      ? new Date() > subscription.expiryDate
      : false;
    const isPremium = isActive && !hasExpired;

    return NextResponse.json({
      hasSubscription: true,
      subscription,
      isPremium,
    });
  } catch (error) {
    if (error instanceof FirebaseAdminConfigError) {
      console.error("subscription/check: Firebase Admin SDKの設定エラー");
      return NextResponse.json(
        { error: "認証サービスが利用できません" },
        { status: 503 }
      );
    }
    console.error(`購入状態確認エラー: ${sanitizeError(error)}`);
    return NextResponse.json(
      { error: "サブスクリプション状態の確認に失敗しました" },
      { status: 500 }
    );
  }
}
