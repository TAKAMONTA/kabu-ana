import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import type { Subscription } from "@/lib/types/subscription";

// Firebase Admin SDKの初期化
let adminApp: App | null = null;

function getAdminApp() {
  if (adminApp) {
    return adminApp;
  }

  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY環境変数が設定されていません");
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    adminApp = initializeApp({
      credential: cert(serviceAccount),
    });
    return adminApp;
  } catch (error) {
    console.error("Firebase Admin SDK初期化エラー:", error);
    throw new Error("Firebase Admin SDKの初期化に失敗しました");
  }
}

/**
 * 購入状態を確認するAPI
 * GET /api/subscription/check
 * 
 * クエリパラメータ:
 * - idToken: Firebase Auth ID Token
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const idToken = searchParams.get("idToken");

    if (!idToken) {
      return NextResponse.json(
        { error: "idTokenが必要です" },
        { status: 400 }
      );
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
      expiryDate: data.expiryDate?.toDate() || (data.expiryDate ? new Date(data.expiryDate) : undefined),
      isTrial: data.isTrial || false,
      createdAt: data.createdAt?.toDate() || new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate() || new Date(data.updatedAt),
    };

    // 有効期限をチェック
    const isActive = subscription.status === "active" || subscription.status === "trial";
    const hasExpired = subscription.expiryDate 
      ? new Date() > subscription.expiryDate 
      : false;
    const isPremium = isActive && !hasExpired;

    return NextResponse.json({
      hasSubscription: true,
      subscription,
      isPremium,
    });
  } catch (error: any) {
    console.error("購入状態確認エラー:", error);
    return NextResponse.json(
      { error: error.message || "購入状態の確認に失敗しました" },
      { status: 500 }
    );
  }
}

