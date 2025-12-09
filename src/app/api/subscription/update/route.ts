import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import type { SubscriptionStatus, SubscriptionPlatform } from "@/lib/types/subscription";

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
 * Android版から購入状態を更新するAPI
 * POST /api/subscription/update
 * 
 * リクエストボディ:
 * {
 *   idToken: string,           // Firebase Auth ID Token
 *   status: SubscriptionStatus,
 *   platform: "android",
 *   productId: string,
 *   purchaseToken: string,     // Google Play購入トークン
 *   expiryDate?: string,       // ISO形式の日時文字列（オプション）
 *   isTrial?: boolean
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken, status, platform, productId, purchaseToken, orderId, expiryDate, isTrial } = body;

    // 必須パラメータの検証
    if (!idToken || !status || !platform || !productId) {
      return NextResponse.json(
        { error: "必須パラメータが不足しています" },
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

    // Firestoreに購入状態を保存
    const subscriptionRef = db.collection("subscriptions").doc(userId);
    
    const subscriptionData: any = {
      userId,
      status: status as SubscriptionStatus,
      platform: platform as SubscriptionPlatform,
      productId,
      purchaseToken: purchaseToken || null,
      orderId: orderId || null,
      purchaseDate: FieldValue.serverTimestamp(),
      isTrial: isTrial || false,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (expiryDate) {
      subscriptionData.expiryDate = new Date(expiryDate);
    }

    await subscriptionRef.set(subscriptionData, { merge: true });

    return NextResponse.json({
      success: true,
      message: "購入状態を更新しました",
    });
  } catch (error: any) {
    console.error("購入状態更新エラー:", error);
    return NextResponse.json(
      { error: error.message || "購入状態の更新に失敗しました" },
      { status: 500 }
    );
  }
}

