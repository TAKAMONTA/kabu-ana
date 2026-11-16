import crypto from "crypto";
import type {
  SubscriptionPlatform,
  SubscriptionStatus,
} from "@/lib/types/subscription";
import { sanitizeError } from "@/lib/utils/logSanitizer";

type NativePlatform = Extract<SubscriptionPlatform, "ios" | "android">;

export interface NativePurchaseUpdateRequest {
  idToken?: string;
  platform?: string;
  productId?: string;
  purchaseToken?: string;
  orderId?: string;
  status?: string;
  expiryDate?: string;
  isTrial?: boolean;
}

export interface VerifiedNativePurchase {
  platform: NativePlatform;
  productId: string;
  purchaseToken: string;
  originalTransactionId?: string;
  status: SubscriptionStatus;
  expiryDate?: string;
  purchaseDate?: string;
  isTrial: boolean;
  environment?: "Production" | "Sandbox" | "GooglePlay";
  raw: unknown;
}

export class PurchaseVerificationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "PurchaseVerificationError";
  }
}

const DEFAULT_IOS_PRODUCT_IDS = [
  "com.takaapps.kabunavi.Monthly",
  "com.takaapps.kabunavi.Yearly",
];

const DEFAULT_ANDROID_PRODUCT_IDS = ["premium_monthly", "premium_yearly"];

function csvEnv(name: string, fallback: string[]): string[] {
  const value = process.env[name];
  if (!value) return fallback;
  return value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

export function isAllowedNativeProduct(
  platform: NativePlatform,
  productId: string
): boolean {
  const allowed =
    platform === "ios"
      ? csvEnv("IOS_SUBSCRIPTION_PRODUCT_IDS", DEFAULT_IOS_PRODUCT_IDS)
      : csvEnv("ANDROID_SUBSCRIPTION_PRODUCT_IDS", DEFAULT_ANDROID_PRODUCT_IDS);
  return allowed.includes(productId);
}

export function parseNativePurchaseUpdateRequest(
  body: NativePurchaseUpdateRequest
): Required<Pick<NativePurchaseUpdateRequest, "idToken" | "platform" | "productId" | "purchaseToken">> & {
  platform: NativePlatform;
} {
  const platform = body.platform;
  if (platform !== "ios" && platform !== "android") {
    throw new PurchaseVerificationError("未対応の購入プラットフォームです", 400);
  }

  if (!body.idToken || !body.productId || !body.purchaseToken) {
    throw new PurchaseVerificationError("購入検証に必要なパラメータが不足しています", 400);
  }

  if (!isAllowedNativeProduct(platform, body.productId)) {
    throw new PurchaseVerificationError("未登録の商品IDです", 400);
  }

  return {
    idToken: body.idToken,
    platform,
    productId: body.productId,
    purchaseToken: body.purchaseToken,
  };
}

export function buildSubscriptionDocumentFromVerification(
  userId: string,
  request: NativePurchaseUpdateRequest,
  verified: VerifiedNativePurchase
) {
  if (request.platform && request.platform !== verified.platform) {
    throw new PurchaseVerificationError("購入プラットフォームが一致しません", 400);
  }
  // 商品はストアの検証結果を正とする。同じサブスクリプショングループ内の
  // アップグレード／クロスグレード（Monthly → Yearly）では保存済みの productId と
  // 最新の取引の productId が変わるため、一致ではなく許可リストで確認する
  if (
    request.productId &&
    request.productId !== verified.productId &&
    !isAllowedNativeProduct(verified.platform, verified.productId)
  ) {
    throw new PurchaseVerificationError("商品IDが一致しません", 400);
  }

  const document: {
    userId: string;
    status: SubscriptionStatus;
    platform: NativePlatform;
    productId: string;
    purchaseToken: string;
    orderId: string | null;
    purchaseDate: Date;
    expiryDate?: Date;
    isTrial: boolean;
    storeValidation: {
      environment: string | null;
      validatedAt: string;
    };
  } = {
    userId,
    status: verified.status,
    platform: verified.platform,
    productId: verified.productId,
    purchaseToken: verified.purchaseToken,
    orderId: verified.originalTransactionId || request.orderId || null,
    purchaseDate: verified.purchaseDate ? new Date(verified.purchaseDate) : new Date(),
    isTrial: verified.isTrial,
    storeValidation: {
      environment: verified.environment || null,
      validatedAt: new Date().toISOString(),
    },
  };

  if (verified.expiryDate) {
    document.expiryDate = new Date(verified.expiryDate);
  }

  return document;
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeJwtPayload<T extends Record<string, any>>(jws: string): T {
  const payload = jws.split(".")[1];
  if (!payload) {
    throw new PurchaseVerificationError("ストア応答の署名データ形式が不正です", 502);
  }
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

/** 設定不備（環境変数の未設定・不正）時にクライアントへ返す固定文言 */
export const PURCHASE_VERIFICATION_UNAVAILABLE_MESSAGE =
  "購入検証サービスが現在利用できません。時間をおいて再度お試しください。";
/** ストアとの通信失敗・想定外の応答時にクライアントへ返す固定文言 */
export const STORE_COMMUNICATION_FAILED_MESSAGE =
  "ストアとの通信に失敗しました。時間をおいて再度お試しください。";

/** ストアAPI呼び出しのタイムアウト */
const STORE_FETCH_TIMEOUT_MS = 10_000;

/**
 * 設定不備を 503 の固定文言で表す。環境変数名などの詳細はサーバーログにだけ残す
 * （2026-08-16 の設定エラー漏えい障害と同じ轍を踏まないため）。
 */
function configError(detail: string): PurchaseVerificationError {
  console.error(`購入検証の設定エラー: ${detail}`);
  return new PurchaseVerificationError(
    PURCHASE_VERIFICATION_UNAVAILABLE_MESSAGE,
    503
  );
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw configError(`${name} が設定されていません`);
  }
  return value;
}

/**
 * ストアAPIの失敗ステータスを、クライアントへ返すステータスに変換する。
 * - 401/403: こちらの認証情報（鍵・権限）の問題なので設定エラー扱い（503）
 * - 429/5xx/その他: 一時的な障害として 502
 * - 400: 送られた購入情報が不正（400）
 * 上流のステータスをそのまま返すと、401 が「再ログインが必要」と誤解される。
 */
function storeFailure(
  store: string,
  status: number,
  body: unknown
): PurchaseVerificationError {
  console.error(
    `${store} 購入検証APIエラー: status=${status}, body=${sanitizeError(
      JSON.stringify(body ?? null)
    )}`
  );
  if (status === 401 || status === 403) {
    return new PurchaseVerificationError(
      PURCHASE_VERIFICATION_UNAVAILABLE_MESSAGE,
      503
    );
  }
  if (status === 400) {
    return new PurchaseVerificationError("購入情報を確認できませんでした", 400);
  }
  return new PurchaseVerificationError(STORE_COMMUNICATION_FAILED_MESSAGE, 502);
}

function createAppStoreServerJwt(): string {
  try {
    return signAppStoreServerJwt();
  } catch (error) {
    if (error instanceof PurchaseVerificationError) throw error;
    // 秘密鍵の形式不正など。詳細（鍵の断片を含み得る）はログにも出さない
    throw configError("App Store Server API の JWT 署名に失敗しました");
  }
}

function signAppStoreServerJwt(): string {
  const keyId = requiredEnv("APP_STORE_CONNECT_KEY_ID");
  const issuerId = requiredEnv("APP_STORE_CONNECT_ISSUER_ID");
  const bundleId = process.env.IOS_BUNDLE_ID || "com.takaapps.kabunavi";
  const privateKey = normalizePrivateKey(
    requiredEnv("APP_STORE_CONNECT_PRIVATE_KEY")
  );
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: issuerId,
      iat: now,
      exp: now + 15 * 60,
      aud: "appstoreconnect-v1",
      bid: bundleId,
    })
  );
  const signingInput = `${header}.${payload}`;
  const signature = crypto
    .createSign("SHA256")
    .update(signingInput)
    .end()
    .sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${base64Url(signature)}`;
}

async function fetchJson(url: string, init?: RequestInit): Promise<{
  ok: boolean;
  status: number;
  body: any;
}> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(STORE_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    console.error(`ストアAPIへの接続に失敗しました: ${sanitizeError(error)}`);
    throw new PurchaseVerificationError(STORE_COMMUNICATION_FAILED_MESSAGE, 502);
  }
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

function statusFromExpiry(expiryDate?: string, revoked?: boolean): SubscriptionStatus {
  if (revoked) return "cancelled";
  if (!expiryDate) return "active";
  return new Date(expiryDate).getTime() > Date.now() ? "active" : "expired";
}

/**
 * App Store Server API のサブスクリプション状態（Get All Subscription Statuses の
 * lastTransactions[].status）を内部状態に変換する。
 *   1 = Active / 2 = Expired / 3 = Billing retry / 4 = Billing grace period / 5 = Revoked
 * 4（請求猶予期間）は Apple の仕様上「利用を継続させる」期間なので active。
 * この間は取引の expiresDate が過ぎているため、期限は gracePeriodExpiresDate を使う
 * （呼び出し側で expiryDate に反映する）。
 */
export function appleSubscriptionStatusToSubscriptionStatus(
  status: number | undefined,
  expiryDate?: string,
  revoked?: boolean
): SubscriptionStatus {
  if (revoked || status === 5) return "cancelled";
  if (status === 4) return "active";
  if (status === 1) return statusFromExpiry(expiryDate, false);
  if (status === 2) return "expired";
  if (status === 3) return "pending";
  return statusFromExpiry(expiryDate, false);
}

/**
 * 同じ originalTransactionId（同じ購読の系列）の最新の取引を返す。
 * productId では絞らない: Monthly → Yearly のようなアップグレード後は最新の取引の
 * productId が保存済みの値と変わるため、productId で絞ると何も見つからず古い取引
 * （期限切れ）に戻ってしまっていた。代わりに許可リスト外の商品は除外する。
 */
async function fetchLatestAppleSubscriptionTransaction(
  baseUrl: string,
  headers: Record<string, string>,
  originalTransactionId: string
): Promise<{
  payload: Record<string, any>;
  status?: number;
  renewalInfo?: Record<string, any>;
} | null> {
  const response = await fetchJson(
    `${baseUrl}/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`,
    { headers }
  );
  if (!response.ok) return null;

  const candidates: Array<{
    payload: Record<string, any>;
    status?: number;
    renewalInfo?: Record<string, any>;
  }> = [];
  for (const group of response.body?.data || []) {
    for (const transaction of group?.lastTransactions || []) {
      if (!transaction?.signedTransactionInfo) continue;
      const payload = decodeJwtPayload<Record<string, any>>(
        transaction.signedTransactionInfo
      );
      const sameLineage =
        String(payload.originalTransactionId ?? transaction.originalTransactionId ?? "") ===
        originalTransactionId;
      if (
        sameLineage &&
        typeof payload.productId === "string" &&
        isAllowedNativeProduct("ios", payload.productId)
      ) {
        let renewalInfo: Record<string, any> | undefined;
        if (transaction.signedRenewalInfo) {
          try {
            renewalInfo = decodeJwtPayload<Record<string, any>>(
              transaction.signedRenewalInfo
            );
          } catch {
            renewalInfo = undefined;
          }
        }
        candidates.push({
          payload,
          status: Number(transaction.status),
          renewalInfo,
        });
      }
    }
  }

  return (
    candidates.sort((left, right) => {
      const leftExpiry = Number(left.payload.expiresDate || 0);
      const rightExpiry = Number(right.payload.expiresDate || 0);
      return rightExpiry - leftExpiry;
    })[0] || null
  );
}

async function verifyApplePurchase(
  request: ReturnType<typeof parseNativePurchaseUpdateRequest>
): Promise<VerifiedNativePurchase> {
  const token = createAppStoreServerJwt();
  const headers = { Authorization: `Bearer ${token}` };
  const encodedTransactionId = encodeURIComponent(request.purchaseToken);
  const endpoints = [
    {
      environment: "Production" as const,
      baseUrl: "https://api.storekit.itunes.apple.com",
      url: `https://api.storekit.itunes.apple.com/inApps/v1/transactions/${encodedTransactionId}`,
    },
    {
      environment: "Sandbox" as const,
      baseUrl: "https://api.storekit-sandbox.itunes.apple.com",
      url: `https://api.storekit-sandbox.itunes.apple.com/inApps/v1/transactions/${encodedTransactionId}`,
    },
  ];

  let lastError: any = null;
  for (const endpoint of endpoints) {
    const result = await fetchJson(endpoint.url, { headers });
    if (!result.ok) {
      lastError = result.body;
      if (result.status === 404) continue;
      throw storeFailure("App Store", result.status, result.body);
    }

    const signedTransactionInfo = result.body?.signedTransactionInfo;
    if (!signedTransactionInfo) {
      throw new PurchaseVerificationError("App Store検証応答が不正です", 502);
    }

    const initialPayload = decodeJwtPayload<Record<string, any>>(signedTransactionInfo);
    const bundleId = process.env.IOS_BUNDLE_ID || "com.takaapps.kabunavi";
    if (initialPayload.bundleId !== bundleId) {
      throw new PurchaseVerificationError("Bundle IDが一致しません", 400);
    }
    if (initialPayload.productId !== request.productId) {
      throw new PurchaseVerificationError("商品IDが一致しません", 400);
    }
    if (
      initialPayload.transactionId !== request.purchaseToken &&
      initialPayload.originalTransactionId !== request.purchaseToken
    ) {
      throw new PurchaseVerificationError("トランザクションIDが一致しません", 400);
    }

    const latest = initialPayload.originalTransactionId
      ? await fetchLatestAppleSubscriptionTransaction(
          endpoint.baseUrl,
          headers,
          String(initialPayload.originalTransactionId)
        )
      : null;
    const payload = latest?.payload || initialPayload;
    const transactionExpiresDate = payload.expiresDate
      ? new Date(Number(payload.expiresDate)).toISOString()
      : undefined;
    // 請求猶予期間（status 4）は取引の期限が過ぎていても猶予の終わりまで有効
    const gracePeriodExpiresDate =
      latest?.status === 4 && latest.renewalInfo?.gracePeriodExpiresDate
        ? new Date(Number(latest.renewalInfo.gracePeriodExpiresDate)).toISOString()
        : undefined;
    const expiresDate = gracePeriodExpiresDate || transactionExpiresDate;
    const purchaseDate = payload.purchaseDate
      ? new Date(Number(payload.purchaseDate)).toISOString()
      : undefined;

    return {
      platform: "ios",
      productId: payload.productId,
      purchaseToken: String(payload.transactionId || request.purchaseToken),
      originalTransactionId: payload.originalTransactionId
        ? String(payload.originalTransactionId)
        : undefined,
      status: appleSubscriptionStatusToSubscriptionStatus(
        latest?.status,
        expiresDate,
        Boolean(payload.revocationDate)
      ),
      expiryDate: expiresDate,
      purchaseDate,
      isTrial: payload.offerType === 1,
      environment: endpoint.environment,
      raw: payload,
    };
  }

  console.error(
    `App Storeトランザクションが見つかりません: ${sanitizeError(
      JSON.stringify(lastError ?? null)
    )}`
  );
  throw new PurchaseVerificationError(
    "App Storeトランザクションが見つかりません",
    404
  );
}

function createGoogleServiceJwt(serviceAccount: any): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 60 * 60,
    })
  );
  const signingInput = `${header}.${payload}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(signingInput)
    .end()
    .sign(normalizePrivateKey(serviceAccount.private_key));
  return `${signingInput}.${base64Url(signature)}`;
}

async function getGoogleAccessToken(): Promise<string> {
  const rawServiceAccount = requiredEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_KEY");
  let assertion: string;
  try {
    assertion = createGoogleServiceJwt(JSON.parse(rawServiceAccount));
  } catch {
    // JSON.parse のエラー文には値の断片が含まれ得るため、詳細は出さない
    throw configError(
      "GOOGLE_PLAY_SERVICE_ACCOUNT_KEY の形式が不正か、JWT 署名に失敗しました"
    );
  }
  const response = await fetchJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok || !response.body?.access_token) {
    // トークン発行の失敗はこちらのサービスアカウント設定の問題
    console.error(
      `Google Play 認証トークンの取得に失敗しました: status=${response.status}`
    );
    throw new PurchaseVerificationError(
      PURCHASE_VERIFICATION_UNAVAILABLE_MESSAGE,
      503
    );
  }
  return response.body.access_token;
}

function isFutureTimestamp(value?: string): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now();
}

function googleStatusToSubscriptionStatus(
  status: string,
  expiryDate?: string
): SubscriptionStatus {
  switch (status) {
    case "SUBSCRIPTION_STATE_ACTIVE":
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      return "active";
    case "SUBSCRIPTION_STATE_PENDING":
    case "SUBSCRIPTION_STATE_ON_HOLD":
    case "SUBSCRIPTION_STATE_PAUSED":
      return "pending";
    case "SUBSCRIPTION_STATE_CANCELED":
      return isFutureTimestamp(expiryDate) ? "active" : "expired";
    case "SUBSCRIPTION_STATE_EXPIRED":
      return "expired";
    default:
      return "pending";
  }
}

async function verifyGooglePurchase(
  request: ReturnType<typeof parseNativePurchaseUpdateRequest>
): Promise<VerifiedNativePurchase> {
  const packageName =
    process.env.GOOGLE_PLAY_PACKAGE_NAME ||
    process.env.ANDROID_APPLICATION_ID ||
    "app.vercel.kabu_9t7mdgybz_takamontas_projects.twa";
  const token = await getGoogleAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    packageName
  )}/purchases/subscriptionsv2/tokens/${encodeURIComponent(request.purchaseToken)}`;
  const response = await fetchJson(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 404 || response.status === 410) {
      console.error(
        `Google Play 購入が見つかりません: status=${response.status}`
      );
      throw new PurchaseVerificationError("Google Playの購入が見つかりません", 404);
    }
    throw storeFailure("Google Play", response.status, response.body);
  }

  const body = response.body;
  const lineItems = Array.isArray(body?.lineItems) ? body.lineItems : [];
  const matchingLineItem =
    lineItems.find((item: any) => item.productId === request.productId) ||
    lineItems[0];

  if (!matchingLineItem || matchingLineItem.productId !== request.productId) {
    throw new PurchaseVerificationError("Google Playの商品IDが一致しません", 400);
  }

  return {
    platform: "android",
    productId: matchingLineItem.productId,
    purchaseToken: request.purchaseToken,
    originalTransactionId:
      matchingLineItem.latestSuccessfulOrderId || body?.latestOrderId,
    status: googleStatusToSubscriptionStatus(
      body?.subscriptionState,
      matchingLineItem.expiryTime
    ),
    expiryDate: matchingLineItem.expiryTime,
    purchaseDate: body?.startTime,
    isTrial: Boolean(
      matchingLineItem.offerDetails?.offerTags?.some((tag: string) =>
        tag.toLowerCase().includes("trial")
      )
    ),
    environment: "GooglePlay",
    raw: body,
  };
}

export async function verifyNativePurchase(
  request: ReturnType<typeof parseNativePurchaseUpdateRequest>
): Promise<VerifiedNativePurchase> {
  return request.platform === "ios"
    ? verifyApplePurchase(request)
    : verifyGooglePurchase(request);
}
