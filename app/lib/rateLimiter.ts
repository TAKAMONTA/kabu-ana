interface RateLimitInfo {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitInfo> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canMakeRequest(key: string): boolean {
    const now = Date.now();
    const limitInfo = this.limits.get(key);

    if (!limitInfo) {
      this.limits.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (now > limitInfo.resetTime) {
      this.limits.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    // 縺ｾ縺繝ｪ繧ｯ繧ｨ繧ｹ繝亥庄閭ｽ縺ｪ蝣ｴ蜷・
    if (limitInfo.count < this.maxRequests) {
      limitInfo.count++;
      return true;
    }

    return false;
  }

  getRemainingRequests(key: string): number {
    const limitInfo = this.limits.get(key);
    if (!limitInfo) return this.maxRequests;

    const now = Date.now();
    if (now > limitInfo.resetTime) return this.maxRequests;

    return Math.max(0, this.maxRequests - limitInfo.count);
  }

  getResetTime(key: string): number {
    const limitInfo = this.limits.get(key);
    if (!limitInfo) return Date.now() + this.windowMs;
    return limitInfo.resetTime;
  }
}

export const rateLimiter = new RateLimiter(10, 60000); // 1分間に10リクエスト

export function checkRateLimit(userId: string): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
} {
  const allowed = rateLimiter.canMakeRequest(userId);
  const remaining = rateLimiter.getRemainingRequests(userId);
  const resetTime = rateLimiter.getResetTime(userId);
  const resetIn = Math.max(0, Math.ceil((resetTime - Date.now()) / 1000));

  return {
    allowed,
    remaining,
    resetIn,
  };
}
