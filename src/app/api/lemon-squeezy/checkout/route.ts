import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { createCheckout } from "@/lib/lemon-squeezy";

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
 * チェックアウトセッションを作成
 * POST /api/lemon-squeezy/checkout
 * 
 * リクエストボディ:
 * {
 *   idToken: string,  // Firebase Auth ID Token
 *   planType: "monthly" | "yearly"  // プランタイプ
 * }
 * 
 * レスポンス:
 * {
 *   checkoutUrl: string  // Lemon SqueezyのチェックアウトページURL
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken, planType = "monthly" } = body;

    // プランタイプに応じてVariant IDを取得
    const variantId = planType === "yearly"
      ? process.env.LEMON_SQUEEZY_VARIANT_ID_YEARLY
      : process.env.LEMON_SQUEEZY_VARIANT_ID_MONTHLY;

    if (!variantId) {
      console.error(`LEMON_SQUEEZY_VARIANT_ID_${planType.toUpperCase()} is not set`);
      return NextResponse.json(
        { error: "課金システムが設定されていません" },
        { status: 500 }
      );
    }

    // Firebase Auth ID Tokenの検証（オプション: 未ログインでも購入可能にする場合）
    let userId: string | null = null;
    let userEmail: string | null = null;

    if (idToken) {
      try {
        const app = getAdminApp();
        const auth = getAuth(app);
        const decodedToken = await auth.verifyIdToken(idToken);
        userId = decodedToken.uid;
        userEmail = decodedToken.email || null;
      } catch (error) {
        console.warn("ID Token検証失敗（ゲスト購入として処理）:", error);
      }
    }

    // リダイレクトURLの設定
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "http://localhost:3000";
    const redirectUrl = `${baseUrl}?purchase=success`;

    // チェックアウトセッションを作成
    const checkout = await createCheckout({
      variantId,
      customData: {
        userId: userId || undefined,
        email: userEmail || undefined,
      },
      productOptions: {
        redirectUrl,
      },
      checkoutOptions: {
        embed: false,
        media: true,
        logo: true,
        desc: true,
        discount: true,
        dark: false,
        subscriptionPreview: true,
      },
    });

    const checkoutUrl = checkout.data.attributes.url;

    return NextResponse.json({
      checkoutUrl,
    });
  } catch (error: any) {
    console.error("チェックアウト作成エラー:", error);
    return NextResponse.json(
      { error: error.message || "チェックアウトの作成に失敗しました" },
      { status: 500 }
    );
  }
}

