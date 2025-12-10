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

// このルートは動的レンダリングが必要
export const dynamic = 'force-dynamic';

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

    // 環境変数のチェック
    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    const storeId = process.env.LEMON_SQUEEZY_STORE_ID;
    const variantId = planType === "yearly"
      ? process.env.LEMON_SQUEEZY_VARIANT_ID_YEARLY
      : process.env.LEMON_SQUEEZY_VARIANT_ID_MONTHLY;

    if (!apiKey) {
      console.error("LEMON_SQUEEZY_API_KEY is not set");
      return NextResponse.json(
        { error: "LEMON_SQUEEZY_API_KEY環境変数が設定されていません" },
        { status: 500 }
      );
    }

    if (!storeId) {
      console.error("LEMON_SQUEEZY_STORE_ID is not set");
      return NextResponse.json(
        { error: "LEMON_SQUEEZY_STORE_ID環境変数が設定されていません" },
        { status: 500 }
      );
    }

    if (!variantId) {
      console.error(`LEMON_SQUEEZY_VARIANT_ID_${planType.toUpperCase()} is not set`);
      return NextResponse.json(
        { error: `LEMON_SQUEEZY_VARIANT_ID_${planType.toUpperCase()}環境変数が設定されていません` },
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
    const errorMessage = error.message || "チェックアウトの作成に失敗しました";
    
    // 404エラーの場合は、環境変数やIDが間違っている可能性がある
    if (errorMessage.includes("404")) {
      return NextResponse.json(
        { 
          error: "商品が見つかりません。Variant IDまたはStore IDが正しいか確認してください。",
          details: errorMessage 
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

