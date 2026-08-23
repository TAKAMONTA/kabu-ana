import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAdminApp } from "@/lib/firebase/admin";
import {
  buildSubscriptionDocumentFromVerification,
  parseNativePurchaseUpdateRequest,
  PurchaseVerificationError,
  verifyNativePurchase,
} from "@/lib/purchases/nativePurchaseVerification";

export const dynamic = process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

/**
 * Android版・iOS版から購入状態を更新するAPI
 * POST /api/subscription/update
 * 
 * リクエストボディ:
 * {
 *   idToken: string,           // Firebase Auth ID Token
 *   platform: "android" | "ios",
 *   productId: string,
 *   purchaseToken: string,     // Google Play購入トークン or StoreKit transactionId
 * }
 */
export async function POST(request: NextRequest) {
  // 静的エクスポート時はビルドエラーを防ぐためダミーを返す
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }

  try {
    const body = await request.json();
    const purchaseRequest = parseNativePurchaseUpdateRequest(body);

    // Firebase Admin SDKの初期化
    const app = getAdminApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Firebase Auth ID Tokenの検証
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(purchaseRequest.idToken);
    } catch (error) {
      console.error("ID Token検証エラー:", error);
      return NextResponse.json(
        { error: "認証に失敗しました" },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    const verifiedPurchase = await verifyNativePurchase(purchaseRequest);

    // Firestoreに購入状態を保存
    const subscriptionRef = db.collection("subscriptions").doc(userId);
    const existingSubscription = await subscriptionRef.get();

    const subscriptionData = {
      ...buildSubscriptionDocumentFromVerification(
        userId,
        purchaseRequest,
        verifiedPurchase
      ),
      updatedAt: FieldValue.serverTimestamp(),
      ...(existingSubscription.exists
        ? {}
        : { createdAt: FieldValue.serverTimestamp() }),
    };

    await subscriptionRef.set(subscriptionData, { merge: true });

    return NextResponse.json({
      success: true,
      message: "購入状態を更新しました",
      subscription: {
        status: subscriptionData.status,
        platform: subscriptionData.platform,
        productId: subscriptionData.productId,
        expiryDate: subscriptionData.expiryDate?.toISOString(),
        isTrial: subscriptionData.isTrial,
      },
    });
  } catch (error: any) {
    console.error("購入状態更新エラー:", error);
    if (error instanceof PurchaseVerificationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "購入状態の更新に失敗しました" },
      { status: 500 }
    );
  }
}
