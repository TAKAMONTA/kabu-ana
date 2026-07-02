import { NextRequest } from "next/server";
import { getJstDateString } from "@/lib/utils/jstDate";

/** 無料プランの1日あたりのAI機能利用上限 */
export const FREE_DAILY_LIMIT = 5;

const DAILY_USAGE_COLLECTION = "daily_usage_limits";

interface DailyUsageRecord {
  count: number;
  date: string; // YYYY-MM-DD (JST)
}

// Firestore が利用不可の場合のメモリフォールバック
const memoryUsageCounts = new Map<string, DailyUsageRecord>();

/**
 * クライアントIPを取得
 */
export function getClientIP(request: NextRequest): string {
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

function getTodayString(): string {
  return getJstDateString();
}

async function getFirestoreDb() {
  const { getAdminApp } = await import("@/lib/auth/verifyAuth");
  const { getFirestore } = await import("firebase-admin/firestore");
  return getFirestore(getAdminApp());
}

async function readUsage(
  clientIP: string,
  today: string
): Promise<DailyUsageRecord> {
  const mem = memoryUsageCounts.get(clientIP);
  try {
    const db = await getFirestoreDb();
    const doc = await db.collection(DAILY_USAGE_COLLECTION).doc(clientIP).get();
    if (!doc.exists) return { count: 0, date: today };
    const data = doc.data() as DailyUsageRecord;
    if (data.date !== today) return { count: 0, date: today };
    return { count: data.count ?? 0, date: today };
  } catch {
    // Firestore 不可時はメモリ値を返す
    if (mem && mem.date === today) return mem;
    return { count: 0, date: today };
  }
}

async function writeUsage(
  clientIP: string,
  record: DailyUsageRecord
): Promise<void> {
  memoryUsageCounts.set(clientIP, record);
  try {
    const db = await getFirestoreDb();
    await db
      .collection(DAILY_USAGE_COLLECTION)
      .doc(clientIP)
      .set(record, { merge: true });
  } catch {
    // メモリフォールバックのみで継続
  }
}

/**
 * 日次利用制限をチェック
 */
export async function checkDailyLimit(request: NextRequest): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
}> {
  const clientIP = getClientIP(request);
  const today = getTodayString();
  const currentData = await readUsage(clientIP, today);
  const remaining = Math.max(0, FREE_DAILY_LIMIT - currentData.count);
  return { allowed: remaining > 0, remaining, limit: FREE_DAILY_LIMIT };
}

/**
 * 日次利用回数をインクリメント
 */
export async function incrementDailyUsage(request: NextRequest): Promise<void> {
  const clientIP = getClientIP(request);
  const today = getTodayString();
  const currentData = await readUsage(clientIP, today);
  const nextCount = currentData.date === today ? currentData.count + 1 : 1;
  await writeUsage(clientIP, { count: nextCount, date: today });
}

/**
 * Firebase IDトークンからプレミアムステータスを確認するヘルパー
 */
export async function checkPremiumStatus(
  request: NextRequest
): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;

  const idToken = authHeader.substring(7);
  if (!idToken) return false;

  try {
    const { getAdminApp } = await import("@/lib/auth/verifyAuth");
    const { getAuth } = await import("firebase-admin/auth");
    const { getFirestore } = await import("firebase-admin/firestore");

    const app = getAdminApp();
    const decodedToken = await getAuth(app).verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const subscriptionDoc = await getFirestore(app)
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
  handler: (request: NextRequest) => Promise<Response>,
  options?: { skip?: (request: NextRequest) => boolean }
) {
  return async (request: NextRequest): Promise<Response> => {
    const isPremium = await checkPremiumStatus(request);
    const skipDailyLimit = options?.skip?.(request) ?? false;

    if (!isPremium && !skipDailyLimit) {
      const limitResult = await checkDailyLimit(request);

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

    const response = await handler(request);

    if (!isPremium && response.ok) {
      if (!skipDailyLimit) {
        await incrementDailyUsage(request);
      }
      const limitResult = await checkDailyLimit(request);
      response.headers.set("X-Daily-Remaining", limitResult.remaining.toString());
      response.headers.set("X-Daily-Limit", FREE_DAILY_LIMIT.toString());
    }

    return response;
  };
}
