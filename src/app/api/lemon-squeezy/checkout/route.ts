import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, FirebaseAdminConfigError } from "@/lib/firebase/admin";
import { createCheckout } from "@/lib/lemon-squeezy";
import { sanitizeError } from "@/lib/utils/logSanitizer";

export const dynamic =
  process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

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
  // 静的エクスポート時はビルドエラーを防ぐためダミーを返す
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }

  let userId: string | null = null;
  let userEmail: string | null = null;

  try {
    const body = await request.json();
    const { idToken, planType = "monthly" } = body;

    // 環境変数のチェック
    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    const storeId = process.env.LEMON_SQUEEZY_STORE_ID;
    const variantId =
      planType === "yearly"
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
      console.error(
        `LEMON_SQUEEZY_VARIANT_ID_${planType.toUpperCase()} is not set`
      );
      return NextResponse.json(
        {
          error: `LEMON_SQUEEZY_VARIANT_ID_${planType.toUpperCase()}環境変数が設定されていません`,
        },
        { status: 500 }
      );
    }

    // Firebase Auth ID Tokenの検証（オプション: 未ログインでも購入可能にする場合）
    if (idToken) {
      // Admin SDKの設定エラーは「ゲスト購入」に握り潰さず中断する。
      // ここを内側catchに含めると、ログイン済みユーザーの購入がuserId無しで
      // 成立してしまい、webhookが購入をユーザーに紐付けられなくなる
      // （課金されたのにpremiumが付かない静かな失敗）。
      let app;
      try {
        app = getAdminApp();
      } catch (error) {
        if (error instanceof FirebaseAdminConfigError) {
          console.error(
            "lemon-squeezy/checkout: Firebase Admin SDKの設定エラー"
          );
          return NextResponse.json(
            { error: "認証サービスが利用できません" },
            { status: 503 }
          );
        }
        throw error;
      }

      try {
        const auth = getAuth(app);
        const decodedToken = await auth.verifyIdToken(idToken);
        userId = decodedToken.uid;
        userEmail = decodedToken.email || null;
      } catch (error) {
        console.warn(
          `ID Token検証失敗（ゲスト購入として処理）: ${sanitizeError(error)}`
        );
      }
    }

    // リダイレクトURLの設定
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      "http://localhost:3000";
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
    const safeMessage = sanitizeError(error, [userId, userEmail]);
    console.error(`チェックアウト作成エラー: ${safeMessage}`);

    // 404エラーの場合は、環境変数やIDが間違っている可能性がある
    if (safeMessage.includes("404")) {
      return NextResponse.json(
        {
          error:
            "商品が見つかりません。Variant IDまたはStore IDが正しいか確認してください。",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "チェックアウトの作成に失敗しました" },
      { status: 500 }
    );
  }
}
