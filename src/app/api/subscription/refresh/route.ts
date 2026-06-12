import { NextRequest, NextResponse } from "next/server";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAdminApp, isAuthError, verifyAuth } from "@/lib/auth/verifyAuth";
import {
  buildSubscriptionDocumentFromVerification,
  parseNativePurchaseUpdateRequest,
  PurchaseVerificationError,
  verifyNativePurchase,
} from "@/lib/purchases/nativePurchaseVerification";

export const dynamic =
  process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

/**
 * 既存のネイティブ購入レコードをストア側で再検証する。
 * 購入復元後やアプリ再インストール後の同期に使う。
 */
export async function POST(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }

  const authResult = await verifyAuth(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  try {
    const app = getAdminApp();
    const db = getFirestore(app);
    const subscriptionRef = db.collection("subscriptions").doc(authResult.uid);
    const snapshot = await subscriptionRef.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        { error: "復元できる購入記録が見つかりません" },
        { status: 404 }
      );
    }

    const current = snapshot.data()!;
    if (current.platform !== "ios" && current.platform !== "android") {
      return NextResponse.json(
        { error: "ネイティブ購入ではないため復元できません" },
        { status: 400 }
      );
    }
    if (!current.productId || !current.purchaseToken) {
      return NextResponse.json(
        { error: "購入検証に必要な保存情報が不足しています" },
        { status: 400 }
      );
    }

    const purchaseRequest = parseNativePurchaseUpdateRequest({
      idToken: "already-authenticated",
      platform: current.platform,
      productId: current.productId,
      purchaseToken: current.purchaseToken,
      orderId: current.orderId,
    });
    const verifiedPurchase = await verifyNativePurchase(purchaseRequest);
    const subscriptionData = {
      ...buildSubscriptionDocumentFromVerification(
        authResult.uid,
        purchaseRequest,
        verifiedPurchase
      ),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await subscriptionRef.set(subscriptionData, { merge: true });

    return NextResponse.json({
      success: true,
      subscription: {
        status: subscriptionData.status,
        platform: subscriptionData.platform,
        productId: subscriptionData.productId,
        expiryDate: subscriptionData.expiryDate?.toISOString(),
        isTrial: subscriptionData.isTrial,
      },
    });
  } catch (error: any) {
    console.error("購入状態再検証エラー:", error);
    if (error instanceof PurchaseVerificationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: error.message || "購入状態の再検証に失敗しました" },
      { status: 500 }
    );
  }
}
