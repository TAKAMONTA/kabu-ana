import { NextRequest } from "next/server";

// メモリベースのレート制限（本番環境ではRedis等を使用推奨）
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// レート制限設定
const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15分
  maxRequests: 100, // 最大リクエスト数
  maxRequestsPerMinute: 20, // 1分間の最大リクエスト数
};

// クライアントIPを取得
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

// レート制限チェック
export function checkRateLimit(request: NextRequest): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const clientIP = getClientIP(request);
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_CONFIG.windowMs;

  // 古いエントリをクリーンアップ
  for (const [ip, data] of requestCounts.entries()) {
    if (data.resetTime < now) {
      requestCounts.delete(ip);
    }
  }

  // 現在のリクエスト数を取得
  const currentData = requestCounts.get(clientIP);

  if (!currentData || currentData.resetTime < now) {
    // 新しいウィンドウを開始
    requestCounts.set(clientIP, {
      count: 1,
      resetTime: now + RATE_LIMIT_CONFIG.windowMs,
    });

    return {
      allowed: true,
      remaining: RATE_LIMIT_CONFIG.maxRequests - 1,
      resetTime: now + RATE_LIMIT_CONFIG.windowMs,
    };
  }

  // リクエスト数をチェック
  if (currentData.count >= RATE_LIMIT_CONFIG.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: currentData.resetTime,
    };
  }

  // リクエスト数を増加
  currentData.count++;

  return {
    allowed: true,
    remaining: RATE_LIMIT_CONFIG.maxRequests - currentData.count,
    resetTime: currentData.resetTime,
  };
}

// レート制限ミドルウェア
export function withRateLimit(
  handler: (request: NextRequest) => Promise<Response>
) {
  return async (request: NextRequest): Promise<Response> => {
    const rateLimitResult = checkRateLimit(request);

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error:
            "レート制限に達しました。しばらく時間をおいてから再試行してください。",
          retryAfter: Math.ceil(
            (rateLimitResult.resetTime - Date.now()) / 1000
          ),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": Math.ceil(
              (rateLimitResult.resetTime - Date.now()) / 1000
            ).toString(),
            "X-RateLimit-Limit": RATE_LIMIT_CONFIG.maxRequests.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
          },
        }
      );
    }

    // レスポンスにレート制限情報を追加
    const response = await handler(request);

    response.headers.set(
      "X-RateLimit-Limit",
      RATE_LIMIT_CONFIG.maxRequests.toString()
    );
    response.headers.set(
      "X-RateLimit-Remaining",
      rateLimitResult.remaining.toString()
    );
    response.headers.set(
      "X-RateLimit-Reset",
      rateLimitResult.resetTime.toString()
    );

    return response;
  };
}
