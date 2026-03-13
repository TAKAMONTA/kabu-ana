import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";

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

export const dynamic = process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

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
            console.error("ID Token検証エラー:", error);
            return NextResponse.json(
                { error: "認証に失敗しました" },
                { status: 401 }
            );
        }

        const userId = decodedToken.uid;

        // 1. Firestoreからサブスクリプションデータを削除
        try {
            await db.collection("subscriptions").doc(userId).delete();
            console.log(`Firestore data deleted for user: ${userId}`);
        } catch (error) {
            console.error("Firestoreデータ削除エラー:", error);
            // データがない場合もあるので、ここでは続行
        }

        // 2. Firebase Authからユーザーを削除
        try {
            await auth.deleteUser(userId);
            console.log(`Firebase Auth user deleted: ${userId}`);
        } catch (error) {
            console.error("Firebase Authユーザー削除エラー:", error);
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
        console.error("アカウント削除エラー:", error);
        return NextResponse.json(
            { error: error.message || "アカウントの削除に失敗しました" },
            { status: 500 }
        );
    }
}
