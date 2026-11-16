import { NextRequest } from "next/server";
import { isSubscriptionPremium } from "@/lib/types/subscription";
import { jstDateId } from "@/lib/digest/dateId";

/** 無料プランの1日あたりのAI機能利用上限 */
const FREE_DAILY_LIMIT = 5;

// メモリベースの日次利用回数管理
const dailyUsageCounts = new Map<string, { count: number; date: string }>();

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

/**
 * 今日の日付文字列（JST の YYYY-MM-DD）。
 * UTC の日付だと日本時間 09:00 に枠がリセットされてしまうため、JST の日付境界に揃える。
 */
function getTodayString(): string {
  return jstDateId(Date.now());
}

/** 古い日付のエントリを掃除する */
function cleanupStaleEntries(today: string): void {
  for (const [ip, data] of dailyUsageCounts.entries()) {
    if (data.date !== today) {
      dailyUsageCounts.delete(ip);
    }
  }
}

/**
 * 日次利用制限をチェック（読み取りのみ。回数は増やさない）
 */
export function checkDailyLimit(request: NextRequest): {
  allowed: boolean;
  remaining: number;
  limit: number;
} {
  const clientIP = getClientIP(request);
  const today = getTodayString();
  cleanupStaleEntries(today);

  const currentData = dailyUsageCounts.get(clientIP);
  const used =
    currentData && currentData.date === today ? currentData.count : 0;
  const remaining = Math.max(0, FREE_DAILY_LIMIT - used);

  return {
    allowed: remaining > 0,
    remaining,
    limit: FREE_DAILY_LIMIT,
  };
}

export interface DailyUsageReservation {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** 予約した1回分を返却する（2回呼んでも1回分しか戻さない） */
  release: () => void;
}

/**
 * 1回分の利用枠を「確認と同時に」確保する。
 * チェックとインクリメントの間に await を挟まない（同期的に行う）ので、
 * 同じインスタンスに並列で届いたリクエストが上限をすり抜けることはない。
 * ハンドラーが失敗した・数えない結果だった場合は release() で返却する。
 *
 * 注意: カウンタはインスタンスごとのメモリにある（従来どおり）。複数インスタンス間の
 * 合算はしないため、厳密な上限ではなく「1インスタンス内での上限」である。
 */
export function reserveDailyUsage(request: NextRequest): DailyUsageReservation {
  const clientIP = getClientIP(request);
  const today = getTodayString();
  cleanupStaleEntries(today);

  const currentData = dailyUsageCounts.get(clientIP);
  const used =
    currentData && currentData.date === today ? currentData.count : 0;

  if (used >= FREE_DAILY_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      limit: FREE_DAILY_LIMIT,
      release: () => {},
    };
  }

  dailyUsageCounts.set(clientIP, { count: used + 1, date: today });
  let released = false;
  return {
    allowed: true,
    remaining: Math.max(0, FREE_DAILY_LIMIT - used - 1),
    limit: FREE_DAILY_LIMIT,
    release: () => {
      if (released) return;
      released = true;
      const entry = dailyUsageCounts.get(clientIP);
      // 日付が変わっていたら（新しい日の枠は別物なので）何もしない
      if (entry && entry.date === today && entry.count > 0) {
        entry.count -= 1;
      }
    },
  };
}

/** テスト用: メモリ上のカウンタを空にする */
export function resetDailyUsageForTests(): void {
  dailyUsageCounts.clear();
}

/**
 * ハンドラーがレスポンスにこのヘッダーを "false" で付けると、そのリクエストは
 * 利用回数に数えない（AI応答の解析失敗・ニュース0件など、利用者に結果を
 * 返せなかったケース）。ヘッダーは withDailyLimit が取り除くので、クライアントには届かない。
 */
export const USAGE_COUNTABLE_HEADER = "X-Usage-Countable";

/** 「このレスポンスは利用回数に数えない」印を付ける */
export function markNotCountable<T extends Response>(response: T): T {
  response.headers.set(USAGE_COUNTABLE_HEADER, "false");
  return response;
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
    const { getAdminApp, FirebaseAdminConfigError } = await import(
      "@/lib/firebase/admin"
    );
    const { getAuth } = await import("firebase-admin/auth");
    const { getFirestore } = await import("firebase-admin/firestore");

    let app;
    try {
      app = getAdminApp();
    } catch (error) {
      if (error instanceof FirebaseAdminConfigError) {
        console.error(
          "checkPremiumStatus: Firebase Admin SDKの設定エラーのため無料枠として扱います"
        );
      }
      return false;
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

    return isSubscriptionPremium(subscriptionDoc.data());
  } catch {
    return false;
  }
}

/**
 * AI機能のAPIルートに適用する日次利用制限ミドルウェア
 * プレミアムユーザーは無制限、無料ユーザーは1日5回まで
 *
 * 1. ハンドラーを呼ぶ前に1回分を予約する（並列リクエストで上限をすり抜けない）
 * 2. ハンドラーが例外・非2xx・X-Usage-Countable: false を返したら予約を返却する
 *
 * skip は「この呼び出しを回数に数えない」判定（AIバンドルトークン等）。非同期でもよい。
 * プレミアムユーザーには評価しない（トークンを無駄に消費しないため）。
 */
export function withDailyLimit(
  handler: (request: NextRequest) => Promise<Response>,
  options?: {
    skip?: (request: NextRequest) => boolean | Promise<boolean>;
  }
) {
  return async (request: NextRequest): Promise<Response> => {
    // プレミアムユーザーかチェック
    const isPremium = await checkPremiumStatus(request);
    const skipDailyLimit =
      !isPremium && options?.skip ? await options.skip(request) : false;

    let reservation: DailyUsageReservation | null = null;
    if (!isPremium && !skipDailyLimit) {
      // 無料ユーザーの日次利用制限チェック（確認と同時に1回分を確保）
      reservation = reserveDailyUsage(request);

      if (!reservation.allowed) {
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
    let response: Response;
    try {
      response = await handler(request);
    } catch (error) {
      reservation?.release();
      throw error;
    }

    const countable = response.headers.get(USAGE_COUNTABLE_HEADER) !== "false";
    response.headers.delete(USAGE_COUNTABLE_HEADER);

    // 失敗・数えない結果なら予約した1回分を返す
    if (reservation && (!response.ok || !countable)) {
      reservation.release();
    }

    if (!isPremium && response.ok) {
      const limitResult = checkDailyLimit(request);
      response.headers.set("X-Daily-Remaining", limitResult.remaining.toString());
      response.headers.set("X-Daily-Limit", FREE_DAILY_LIMIT.toString());
    }

    return response;
  };
}
