import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getAdminApp } from "@/lib/firebase/admin";
import { maskId, sanitizeError } from "@/lib/utils/logSanitizer";

export const dynamic =
  process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

/**
 * ユーザーアカウントとそのデータを削除するAPI
 * POST /api/user/delete
 */
export async function POST(request: NextRequest) {
  // 静的エクスポート時はビルドエラーを防ぐためダミーを返す
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }

  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
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

    // 1. Firestoreからサブスクリプションデータを削除
    // ウォッチリスト（users/{uid} とその配下）の削除とは独立させる。
    // 直列で片方の try にまとめると、前段が失敗した場合に後段が
    // 実行されず、Auth削除後は本人が再試行できないままデータが残る。
    try {
      await db.collection("subscriptions").doc(userId).delete();
      console.info(`Subscription data deleted for user: ${maskId(userId)}`);
    } catch (error) {
      console.error(
        `サブスクリプションデータ削除エラー: ${sanitizeError(error, [userId])}`
      );
      // データがない場合もあるので、ここでは続行
    }

    // 2. Firestoreからウォッチリストデータを削除
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

    // 3. Firestoreから朝ダイジェストを削除（uid フィールドで横断検索）。
    //    前段と同じく独立の try にし、失敗しても他の削除と Auth 削除は続行する
    try {
      const digests = await db
        .collection("user_digests")
        .where("uid", "==", userId)
        .get();
      if (!digests.empty) {
        const batch = db.batch();
        digests.docs.forEach(docSnapshot => batch.delete(docSnapshot.ref));
        await batch.commit();
      }
      console.info(
        `Digest data deleted for user: ${maskId(userId)} (${digests.size} docs)`
      );
    } catch (error) {
      console.error(
        `ダイジェスト削除エラー: ${sanitizeError(error, [userId])}`
      );
      // 続行
    }

    // 2. Firebase Authからユーザーを削除
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

    return NextResponse.json({
      success: true,
      message: "アカウントが正常に削除されました",
    });
  } catch (error: any) {
    const safeMessage = sanitizeError(error);
    console.error(`アカウント削除エラー: ${safeMessage}`);
    return NextResponse.json(
      { error: "アカウント削除中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
