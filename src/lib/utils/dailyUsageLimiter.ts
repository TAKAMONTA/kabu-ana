import { NextRequest } from "next/server";

/** 無料プランの1日あたりのAI機能利用上限 */
const FREE_DAILY_LIMIT = 5;

// メモリベースの日次利用回数管理
const dailyUsageCounts = new Map<string, { count: number; date: string }>();

/**
 * クライアントIPを取得
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  return "unknown";
}

/**
 * 今日の日付文字列を取得（YYYY-MM-DD）
 */
function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * 日次利用制限をチェック
 */
export function checkDailyLimit(request: NextRequest): {
  allowed: boolean;
  remaining: number;
  limit: number;
} {
  const clientIP = getClientIP(request);
  const today = getTodayString();

  // 古いエントリをクリーンアップ
  for (const [ip, data] of dailyUsageCounts.entries()) {
    if (data.date !== today) {
      dailyUsageCounts.delete(ip);
    }
  }

  const currentData = dailyUsageCounts.get(clientIP);

  if (!currentData || currentData.date !== today) {
    // 今日初めてのリクエスト
    return {
      allowed: true,
      remaining: FREE_DAILY_LIMIT,
      limit: FREE_DAILY_LIMIT,
    };
  }

  const remaining = Math.max(0, FREE_DAILY_LIMIT - currentData.count);

  return {
    allowed: remaining > 0,
    remaining,
    limit: FREE_DAILY_LIMIT,
  };
}

/**
 * 日次利用回数をインクリメント
 */
export function incrementDailyUsage(request: NextRequest): void {
  const clientIP = getClientIP(request);
  const today = getTodayString();

  const currentData = dailyUsageCounts.get(clientIP);

  if (!currentData || currentData.date !== today) {
    dailyUsageCounts.set(clientIP, { count: 1, date: today });
  } else {
    currentData.count++;
  }
}

/**
 * Firebase IDトークンからプレミアムステータスを確認するヘルパー
 * トークンが無い場合はfalseを返す
 */
export async function checkPremiumStatus(
  request: NextRequest
): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const idToken = authHeader.substring(7);
  if (!idToken) {
    return false;
  }

  try {
    // Firebase Admin SDK を動的インポート
    const { getApps, initializeApp, cert } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    const { getFirestore } = await import("firebase-admin/firestore");

    let app;
    if (getApps().length > 0) {
      app = getApps()[0];
    } else {
      const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (!serviceAccountKey) return false;
      try {
        const serviceAccount = JSON.parse(serviceAccountKey);
        app = initializeApp({ credential: cert(serviceAccount) });
      } catch {
        return false;
      }
    }

    const auth = getAuth(app);
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const db = getFirestore(app);
    const subscriptionDoc = await db
      .collection("subscriptions")
      .doc(userId)
      .get();

    if (!subscriptionDoc.exists) return false;

    const data = subscriptionDoc.data()!;
    const isActive = data.status === "active" || data.status === "trial";
    const hasExpired = data.expiryDate
      ? new Date() > data.expiryDate.toDate()
      : false;

    return isActive && !hasExpired;
  } catch {
    return false;
  }
}

/**
 * AI機能のAPIルートに適用する日次利用制限ミドルウェア
 * プレミアムユーザーは無制限、無料ユーザーは1日5回まで
 */
export function withDailyLimit(
  handler: (request: NextRequest) => Promise<Response>
) {
  return async (request: NextRequest): Promise<Response> => {
    // プレミアムユーザーかチェック
    const isPremium = await checkPremiumStatus(request);

    if (!isPremium) {
      // 無料ユーザーの日次利用制限チェック
      const limitResult = checkDailyLimit(request);

      if (!limitResult.allowed) {
        return new Response(
          JSON.stringify({
            error:
              "本日の無料利用上限（5回）に達しました。プレミアムプランにアップグレードすると無制限にご利用いただけます。",
            code: "DAILY_LIMIT_EXCEEDED",
            remaining: 0,
            limit: FREE_DAILY_LIMIT,
          }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              "X-Daily-Limit": FREE_DAILY_LIMIT.toString(),
              "X-Daily-Remaining": "0",
            },
          }
        );
      }
    }

    // ハンドラーを実行
    const response = await handler(request);

    // 成功した場合のみカウントをインクリメント
    if (!isPremium && response.ok) {
      incrementDailyUsage(request);
      const limitResult = checkDailyLimit(request);
      response.headers.set("X-Daily-Remaining", limitResult.remaining.toString());
      response.headers.set("X-Daily-Limit", FREE_DAILY_LIMIT.toString());
    }

    return response;
  };
}
