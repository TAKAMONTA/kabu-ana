import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getAdminApp, FirebaseAdminConfigError } from "@/lib/firebase/admin";
import { cancelSubscription, LemonSqueezyApiError } from "@/lib/lemon-squeezy";
import { releasePurchaseOwnership } from "@/lib/purchases/purchaseOwnership";
import { maskId, sanitizeError } from "@/lib/utils/logSanitizer";

export const dynamic = "force-dynamic";

/** Lemon Squeezy の解約に失敗した（削除を中断した）ときの固定文言 */
const CANCEL_FAILED_MESSAGE =
  "サブスクリプションの解約処理に失敗したため、アカウントを削除できませんでした。時間をおいて再度お試しください。";

/** Lemon Squeezy 側で既に請求が止まっている状態 */
const LEMON_SQUEEZY_STOPPED_STATUSES = new Set(["cancelled", "expired"]);

/**
 * 解約が必要な Lemon Squeezy のサブスクリプションIDを返す（不要なら null）。
 * ネイティブ（App Store / Google Play）の購読はサーバーから解約できないため対象外
 * （アプリのUIでストアでの解約を案内している）。
 */
function lemonSqueezySubscriptionToCancel(
  data: Record<string, unknown> | undefined
): string | null {
  if (!data || data.platform !== "web") return null;
  const ls = data.lemonSqueezyData as Record<string, unknown> | undefined;
  const rawId = ls?.subscriptionId;
  const subscriptionId =
    typeof rawId === "string" || typeof rawId === "number"
      ? String(rawId)
      : "";
  if (!subscriptionId) return null;
  if (
    typeof ls?.status === "string" &&
    LEMON_SQUEEZY_STOPPED_STATUSES.has(ls.status)
  ) {
    return null;
  }
  return subscriptionId;
}

/**
 * ユーザーアカウントとそのデータを削除するAPI
 * POST /api/user/delete
 *
 * 1. Lemon Squeezy の有効な購読があれば先に解約する（失敗したら削除を中断 → 502）。
 *    解約せずに消すと課金だけが続き、次の Webhook で subscriptions/{uid} が復活する。
 * 2. Firestore の本人データ（subscriptions / purchase_owners / signals_claude_usage /
 *    users/{uid} 配下）を削除
 * 3. Firebase Auth のユーザーを削除
 */
export async function POST(request: NextRequest) {
  // 静的エクスポート時はビルドエラーを防ぐためダミーを返す
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }

  try {
    const body = await request.json().catch(() => null);
    const idToken =
      body && typeof body === "object"
        ? (body as Record<string, unknown>).idToken
        : undefined;

    if (typeof idToken !== "string" || !idToken) {
      return NextResponse.json(
        { error: "認証トークンが不足しています" },
        { status: 400 }
      );
    }

    // Firebase Admin SDKの初期化
    const app = getAdminApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    // ID Tokenの検証
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
      console.error(`ID Token検証エラー: ${sanitizeError(error)}`);
      return NextResponse.json(
        { error: "認証に失敗しました" },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    const subscriptionRef = db.collection("subscriptions").doc(userId);

    // 0. 課金の停止（Lemon Squeezy）。購読状態が読めない場合は、
    //    課金が続くアカウントを消してしまわないよう削除自体を中断する
    let subscriptionData: Record<string, unknown> | undefined;
    try {
      const snapshot = await subscriptionRef.get();
      subscriptionData = snapshot.exists ? snapshot.data() : undefined;
    } catch (error) {
      console.error(
        `退会: サブスクリプション状態の取得に失敗: ${sanitizeError(error, [userId])}`
      );
      return NextResponse.json(
        {
          error:
            "アカウント削除中にエラーが発生しました。時間をおいて再度お試しください。",
        },
        { status: 500 }
      );
    }

    const lemonSqueezySubscriptionId =
      lemonSqueezySubscriptionToCancel(subscriptionData);
    if (lemonSqueezySubscriptionId) {
      try {
        await cancelSubscription(lemonSqueezySubscriptionId);
        console.info(
          `退会: Lemon Squeezy の購読を解約しました: user=${maskId(userId)}, subscription=${lemonSqueezySubscriptionId}`
        );
      } catch (error) {
        const alreadyGone =
          error instanceof LemonSqueezyApiError && error.status === 404;
        if (!alreadyGone) {
          console.error(
            `退会: Lemon Squeezy の解約に失敗したため削除を中断: user=${maskId(userId)}, ${sanitizeError(error, [userId])}`
          );
          return NextResponse.json(
            { error: CANCEL_FAILED_MESSAGE },
            { status: 502 }
          );
        }
        console.warn(
          `退会: Lemon Squeezy 側に購読が見つからないため解約をスキップ: user=${maskId(userId)}`
        );
      }
    }

    // 1. Firestoreからサブスクリプションデータを削除
    // ウォッチリスト（users/{uid} とその配下）の削除とは独立させる。
    // 直列で片方の try にまとめると、前段が失敗した場合に後段が
    // 実行されず、Auth削除後は本人が再試行できないままデータが残る。
    try {
      await subscriptionRef.delete();
      console.info(`Subscription data deleted for user: ${maskId(userId)}`);
    } catch (error) {
      console.error(
        `サブスクリプションデータ削除エラー: ${sanitizeError(error, [userId])}`
      );
      // データがない場合もあるので、ここでは続行
    }

    // 2. ネイティブ購入の所有記録を解放（同じストア購入を新しいアカウントで復元できるように）
    try {
      const released = await releasePurchaseOwnership(db, userId);
      if (released > 0) {
        console.info(
          `Purchase ownership released for user: ${maskId(userId)} (${released})`
        );
      }
    } catch (error) {
      console.error(
        `購入所有記録の削除エラー: ${sanitizeError(error, [userId])}`
      );
    }

    // 3. 深掘り分析の利用回数（signals_claude_usage/{uid}_{date}）を削除
    try {
      const usageSnapshot = await db
        .collection("signals_claude_usage")
        .where("userId", "==", userId)
        .get();
      await Promise.all(usageSnapshot.docs.map(doc => doc.ref.delete()));
    } catch (error) {
      console.error(
        `深掘り分析の利用記録削除エラー: ${sanitizeError(error, [userId])}`
      );
    }

    // 4. Firestoreからウォッチリストデータを削除
    try {
      // recursiveDelete はサブコレクションまで辿って削除する
      await db.recursiveDelete(db.doc(`users/${userId}`));
      console.info(`Watchlist data deleted for user: ${maskId(userId)}`);
    } catch (error) {
      console.error(
        `ウォッチリストデータ削除エラー: ${sanitizeError(error, [userId])}`
      );
      // データがない場合もあるので、ここでは続行
    }

    // 5. Firebase Authからユーザーを削除
    try {
      await auth.deleteUser(userId);
      console.info(`Firebase Auth user deleted: ${maskId(userId)}`);
    } catch (error) {
      console.error(
        `Firebase Authユーザー削除エラー: ${sanitizeError(error, [userId])}`
      );
      return NextResponse.json(
        { error: "ユーザーの削除に失敗しました" },
        { status: 500 }
      );
    }

    // 6. 解約直後の Webhook が Auth 削除前に届いて subscriptions/{uid} を
    //    作り直していた場合に備えて、もう一度だけ消す（Auth 削除後の Webhook は
    //    ユーザー不在として無視される）
    try {
      await subscriptionRef.delete();
    } catch (error) {
      console.error(
        `サブスクリプションデータの再削除エラー: ${sanitizeError(error, [userId])}`
      );
    }

    return NextResponse.json({
      success: true,
      message: "アカウントが正常に削除されました",
    });
  } catch (error: unknown) {
    if (error instanceof FirebaseAdminConfigError) {
      console.error("user/delete: Firebase Admin SDKの設定エラー");
      return NextResponse.json(
        { error: "認証サービスが利用できません" },
        { status: 503 }
      );
    }
    const safeMessage = sanitizeError(error);
    console.error(`アカウント削除エラー: ${safeMessage}`);
    return NextResponse.json(
      { error: "アカウント削除中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
