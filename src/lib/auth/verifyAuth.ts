import { NextRequest, NextResponse } from "next/server";
import { getAuth, DecodedIdToken } from "firebase-admin/auth";
import { getAdminApp, FirebaseAdminConfigError } from "@/lib/firebase/admin";

export { getAdminApp };

/**
 * Authorization ヘッダーから Firebase ID トークンを検証する。
 * 成功時は DecodedIdToken を返す。失敗時は NextResponse を返す:
 * - ヘッダー無し / トークン検証失敗 → 401
 * - Firebase Admin SDK の設定エラー（環境変数未設定・不正など）→ 503
 *   （設定問題を「再ログインしてください」という401に隠さないための分離。
 *   2026-08-16、設定漏れが401に偽装され長期間気づかれなかった障害の再発防止）
 */
export async function verifyAuth(
  request: NextRequest
): Promise<DecodedIdToken | NextResponse> {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json(
      { error: "認証が必要です。ログインしてください。" },
      { status: 401 }
    );
  }

  let app;
  try {
    app = getAdminApp();
  } catch (error) {
    if (error instanceof FirebaseAdminConfigError) {
      console.error("verifyAuth: Firebase Admin SDKの設定エラー");
      return NextResponse.json(
        { error: "認証サービスが利用できません" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "認証に失敗しました。再ログインしてください。" },
      { status: 401 }
    );
  }

  try {
    const decoded = await getAuth(app).verifyIdToken(token);
    return decoded;
  } catch {
    return NextResponse.json(
      { error: "認証に失敗しました。再ログインしてください。" },
      { status: 401 }
    );
  }
}

/**
 * verifyAuth の結果が認証失敗レスポンスかどうかを判定するヘルパー
 */
export function isAuthError(
  result: DecodedIdToken | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
