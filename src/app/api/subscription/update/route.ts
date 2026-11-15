import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAdminApp, FirebaseAdminConfigError } from "@/lib/firebase/admin";
import { maskId, sanitizeError } from "@/lib/utils/logSanitizer";
import {
  buildSubscriptionDocumentFromVerification,
  parseNativePurchaseUpdateRequest,
  PurchaseVerificationError,
  verifyNativePurchase,
} from "@/lib/purchases/nativePurchaseVerification";
import {
  authUserExists,
  PurchaseOwnedByOtherAccountError,
  writeSubscriptionWithOwnership,
} from "@/lib/purchases/purchaseOwnership";

export const dynamic = "force-dynamic";

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
 *
 * ストアで検証済みの購入でも、最初に登録したアカウント以外には紐付けない
 * （purchase_owners/{key}。別アカウントからの登録は 409）。
 */
export async function POST(request: NextRequest) {
  // 静的エクスポート時はビルドエラーを防ぐためダミーを返す
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }

  let userId: string | undefined;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "購入検証に必要なパラメータが不足しています" },
        { status: 400 }
      );
    }
    const purchaseRequest = parseNativePurchaseUpdateRequest(body);

    // Firebase Admin SDKの初期化
    const app = getAdminApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Firebase Auth ID Tokenの検証
    let decodedToken;
    try {
      // checkRevoked: 退会（Auth 削除）後も約1時間有効な ID トークンで、
      // 削除済み uid の購入記録が作り直されるのを防ぐ
      decodedToken = await auth.verifyIdToken(purchaseRequest.idToken, true);
    } catch (error) {
      console.error(`ID Token検証エラー: ${sanitizeError(error)}`);
      return NextResponse.json(
        { error: "認証に失敗しました" },
        { status: 401 }
      );
    }

    userId = decodedToken.uid;
    const uid = userId;
    const verifiedPurchase = await verifyNativePurchase(purchaseRequest);

    // 所有者確認と保存を1トランザクションで行う
    const subscriptionData = (await writeSubscriptionWithOwnership(
      db,
      uid,
      verifiedPurchase,
      subscriptionExists => ({
        ...buildSubscriptionDocumentFromVerification(
          uid,
          purchaseRequest,
          verifiedPurchase
        ),
        updatedAt: FieldValue.serverTimestamp(),
        ...(subscriptionExists
          ? {}
          : { createdAt: FieldValue.serverTimestamp() }),
      }),
      () => FieldValue.serverTimestamp(),
      authUserExists(auth)
    )) as ReturnType<typeof buildSubscriptionDocumentFromVerification>;

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
  } catch (error: unknown) {
    if (error instanceof FirebaseAdminConfigError) {
      console.error("subscription/update: Firebase Admin SDKの設定エラー");
      return NextResponse.json(
        { error: "認証サービスが利用できません" },
        { status: 503 }
      );
    }
    if (error instanceof PurchaseOwnedByOtherAccountError) {
      console.warn(
        `subscription/update: 別アカウント所有の購入の登録を拒否しました: user=${maskId(userId)}`
      );
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    if (error instanceof PurchaseVerificationError) {
      // PurchaseVerificationError のメッセージはサーバー側で固定した文言のみ
      console.error(
        `subscription/update: 購入検証エラー: ${sanitizeError(error, [userId])}`
      );
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error(`購入状態更新エラー: ${sanitizeError(error, [userId])}`);
    return NextResponse.json(
      { error: "購入状態の更新に失敗しました" },
      { status: 500 }
    );
  }
}
