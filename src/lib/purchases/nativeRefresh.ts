/**
 * ネイティブ購入（App Store / Google Play）の定期的な再検証（クライアント側）。
 *
 * 更新・返金はサーバーに通知されない（App Store Server Notifications / Google RTDN は
 * 未導入）ため、利用者が「購入を復元」を押すまで反映されず、自動更新した人が更新日に
 * プレミアムを失い、返金した人は期限まで使えていた。アプリの起動・復帰時に条件を満たせば
 * /api/subscription/refresh を静かに呼ぶ（失敗しても画面には出さない）。
 */

/** 期限がこの範囲内（または過ぎている）なら再検証する */
export const NATIVE_REFRESH_EXPIRY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
/** 最終検証からこれ以上経っていたら再検証する */
export const NATIVE_REFRESH_STALE_MS = 24 * 60 * 60 * 1000;
/** 端末ごとの再検証の最短間隔 */
export const NATIVE_REFRESH_THROTTLE_MS = 6 * 60 * 60 * 1000;

export interface NativeRefreshCandidate {
  platform?: unknown;
  expiryDate?: Date | null;
  storeValidatedAt?: Date | null;
}

function toMs(value: Date | null | undefined): number | null {
  if (!(value instanceof Date)) return null;
  const ms = value.getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** 再検証すべきか（純粋関数） */
export function shouldRefreshNativeSubscription(
  subscription: NativeRefreshCandidate | null | undefined,
  nowMs: number,
  lastAttemptMs: number | null
): boolean {
  if (!subscription) return false;
  if (subscription.platform !== "ios" && subscription.platform !== "android") {
    return false;
  }
  if (lastAttemptMs !== null && nowMs - lastAttemptMs < NATIVE_REFRESH_THROTTLE_MS) {
    return false;
  }
  const expiryMs = toMs(subscription.expiryDate);
  if (expiryMs !== null && expiryMs - nowMs <= NATIVE_REFRESH_EXPIRY_WINDOW_MS) {
    return true;
  }
  const validatedMs = toMs(subscription.storeValidatedAt);
  return validatedMs === null || nowMs - validatedMs > NATIVE_REFRESH_STALE_MS;
}

export interface NativeRefreshDeps {
  now: () => number;
  /** ネイティブアプリ（iOS / Android）で動いているか */
  isNativeApp: () => Promise<boolean>;
  storage: Pick<Storage, "getItem" | "setItem"> | null;
  /** /api/subscription/refresh を呼ぶ */
  requestRefresh: () => Promise<void>;
}

const storageKey = (uid: string) => `kabuana:nativeRefreshAttemptAt:${uid}`;
let inFlight = false;

function readLastAttempt(
  storage: NativeRefreshDeps["storage"],
  uid: string
): number | null {
  try {
    const raw = storage?.getItem(storageKey(uid));
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeLastAttempt(
  storage: NativeRefreshDeps["storage"],
  uid: string,
  value: number
): void {
  try {
    storage?.setItem(storageKey(uid), String(value));
  } catch {
    // localStorage が使えない環境では間引きなし（同一起動中の多重実行は inFlight で防ぐ）
  }
}

async function defaultDeps(): Promise<NativeRefreshDeps> {
  const { Capacitor, CapacitorHttp } = await import("@capacitor/core");
  const { getApiUrl, getAuthHeaders } = await import("@/lib/utils/apiClient");
  let storage: NativeRefreshDeps["storage"] = null;
  try {
    storage = typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    storage = null;
  }
  return {
    now: () => Date.now(),
    isNativeApp: async () =>
      Capacitor.isNativePlatform() &&
      ["ios", "android"].includes(Capacitor.getPlatform()),
    storage,
    requestRefresh: async () => {
      await CapacitorHttp.post({
        url: getApiUrl("/api/subscription/refresh"),
        headers: await getAuthHeaders(),
        data: {},
      });
    },
  };
}

/**
 * 条件を満たせば再検証を1回だけ行う。結果（成功・失敗）は呼び出し側に返さない
 * （最新の状態は Firestore の購読で画面に反映される）。実行したら true。
 */
export async function maybeRefreshNativeSubscription(
  uid: string,
  subscription: NativeRefreshCandidate | null | undefined,
  depsOverride?: NativeRefreshDeps
): Promise<boolean> {
  if (inFlight) return false;
  try {
    const deps = depsOverride ?? (await defaultDeps());
    if (!(await deps.isNativeApp())) return false;
    const now = deps.now();
    if (
      !shouldRefreshNativeSubscription(
        subscription,
        now,
        readLastAttempt(deps.storage, uid)
      )
    ) {
      return false;
    }
    writeLastAttempt(deps.storage, uid, now);
    inFlight = true;
    try {
      await deps.requestRefresh();
    } catch {
      // 静かに失敗する（次の機会に再試行）
    } finally {
      inFlight = false;
    }
    return true;
  } catch {
    return false;
  }
}
