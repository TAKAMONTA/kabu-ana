import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth, DecodedIdToken } from "firebase-admin/auth";

let adminApp: App | null = null;

function getAdminApp(): App {
  if (adminApp) return adminApp;

  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY環境変数が設定されていません");
  }

  const serviceAccount = JSON.parse(serviceAccountKey);
  adminApp = initializeApp({ credential: cert(serviceAccount) });
  return adminApp;
}

export { getAdminApp };

/**
 * Authorization ヘッダーから Firebase ID トークンを検証する。
 * 成功時は DecodedIdToken を返し、失敗時は NextResponse (401) を返す。
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

  try {
    const app = getAdminApp();
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
