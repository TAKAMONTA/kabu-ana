import { OAuth2Client } from "google-auth-library";

/**
 * Google Play Real-time Developer Notifications（RTDN）を Cloud Pub/Sub の
 * push サブスクリプションで受けるための認証・解析。
 *
 * Pub/Sub は push のたびに、サブスクリプションに設定したサービスアカウントの
 * OIDC ID トークンを Authorization: Bearer で付ける。署名（Google の公開鍵）・
 * 発行者・有効期限・audience を検証し、email がそのサービスアカウントで
 * email_verified が true であることを確かめる。
 */

/** 認証失敗（トークンなし・不正・audience / email 不一致） */
export class RtdnAuthError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "RtdnAuthError";
  }
}

/** 設定不備（環境変数の未設定） */
export class RtdnConfigError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "RtdnConfigError";
  }
}

export interface RtdnAuthConfig {
  /** push サブスクリプションに設定した audience（未設定時の既定値は push エンドポイント URL） */
  audience: string;
  /** push サブスクリプションに設定したサービスアカウントのメールアドレス */
  serviceAccountEmail: string;
}

export function readRtdnAuthConfig(): RtdnAuthConfig {
  const audience = process.env.GOOGLE_RTDN_PUSH_AUDIENCE?.trim();
  const serviceAccountEmail =
    process.env.GOOGLE_RTDN_PUSH_SERVICE_ACCOUNT_EMAIL?.trim();
  if (!audience) {
    throw new RtdnConfigError("GOOGLE_RTDN_PUSH_AUDIENCE が設定されていません");
  }
  if (!serviceAccountEmail) {
    throw new RtdnConfigError(
      "GOOGLE_RTDN_PUSH_SERVICE_ACCOUNT_EMAIL が設定されていません"
    );
  }
  return { audience, serviceAccountEmail };
}

// Google の公開鍵はクライアント内でキャッシュされるので使い回す
let oauthClient: OAuth2Client | null = null;
function getOAuthClient(): OAuth2Client {
  oauthClient ??= new OAuth2Client();
  return oauthClient;
}

/**
 * Authorization ヘッダーの OIDC トークンを検証する。
 * @throws RtdnAuthError
 */
export async function verifyPubSubPushToken(
  authorizationHeader: string | null,
  config: RtdnAuthConfig
): Promise<void> {
  const match = authorizationHeader?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new RtdnAuthError("Authorization ヘッダーがありません");
  }

  let payload: Record<string, unknown> | undefined;
  try {
    // 署名・iss（accounts.google.com）・exp・aud を検証する
    const ticket = await getOAuthClient().verifyIdToken({
      idToken: match[1],
      audience: config.audience,
    });
    payload = ticket.getPayload() as Record<string, unknown> | undefined;
  } catch (error) {
    throw new RtdnAuthError(
      `OIDC トークンの検証に失敗しました: ${error instanceof Error ? error.name : "unknown"}`
    );
  }
  if (!payload) {
    throw new RtdnAuthError("OIDC トークンにペイロードがありません");
  }
  if (payload.email !== config.serviceAccountEmail || payload.email_verified !== true) {
    throw new RtdnAuthError("OIDC トークンのサービスアカウントが一致しません");
  }
}

/** 形式が不正なメッセージ（再送しても直らないので受領扱いにする） */
export class RtdnPayloadError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "RtdnPayloadError";
  }
}

export interface RtdnSubscriptionNotification {
  version?: string;
  notificationType: number;
  purchaseToken: string;
  /** 新しい RTDN では省略されることがある */
  subscriptionId?: string;
}

export interface RtdnVoidedPurchaseNotification {
  purchaseToken: string;
  orderId?: string;
  /** 1 = 定期購入, 2 = 1 回限りの購入 */
  productType?: number;
  refundType?: number;
}

export interface DeveloperNotification {
  version?: string;
  packageName?: string;
  eventTimeMillis?: string | number;
  subscriptionNotification?: RtdnSubscriptionNotification;
  voidedPurchaseNotification?: RtdnVoidedPurchaseNotification;
  testNotification?: { version?: string };
  oneTimeProductNotification?: unknown;
}

export interface ParsedPubSubPush {
  messageId: string;
  notification: DeveloperNotification;
}

/**
 * Pub/Sub push の本文（{ message: { data, messageId, ... }, subscription }）から
 * DeveloperNotification を取り出す。data は base64 の JSON。
 * @throws RtdnPayloadError
 */
export function parsePubSubPush(body: unknown): ParsedPubSubPush {
  const message =
    body && typeof body === "object"
      ? (body as { message?: Record<string, unknown> }).message
      : undefined;
  if (!message || typeof message !== "object") {
    throw new RtdnPayloadError("message がありません");
  }
  const messageId = message.messageId ?? message.message_id;
  if (typeof messageId !== "string" || !messageId) {
    throw new RtdnPayloadError("messageId がありません");
  }
  if (typeof message.data !== "string" || !message.data) {
    throw new RtdnPayloadError("data がありません");
  }
  let notification: unknown;
  try {
    notification = JSON.parse(Buffer.from(message.data, "base64").toString("utf8"));
  } catch {
    throw new RtdnPayloadError("data を解析できません");
  }
  if (!notification || typeof notification !== "object") {
    throw new RtdnPayloadError("data が JSON オブジェクトではありません");
  }
  return { messageId, notification: notification as DeveloperNotification };
}

/**
 * 再検証して subscriptions/{uid} に反映する SubscriptionNotification の種類。
 * 価格変更・一時停止の予約・バンドルの変更など、利用可否が変わらない通知は受領のみ。
 */
export const HANDLED_RTDN_SUBSCRIPTION_TYPES: ReadonlyMap<number, string> = new Map([
  [1, "SUBSCRIPTION_RECOVERED"],
  [2, "SUBSCRIPTION_RENEWED"],
  [3, "SUBSCRIPTION_CANCELED"],
  [4, "SUBSCRIPTION_PURCHASED"],
  [5, "SUBSCRIPTION_ON_HOLD"],
  [6, "SUBSCRIPTION_IN_GRACE_PERIOD"],
  [7, "SUBSCRIPTION_RESTARTED"],
  [9, "SUBSCRIPTION_DEFERRED"],
  [10, "SUBSCRIPTION_PAUSED"],
  [12, "SUBSCRIPTION_REVOKED"],
  [13, "SUBSCRIPTION_EXPIRED"],
  [20, "SUBSCRIPTION_PENDING_PURCHASE_CANCELED"],
]);

export const RTDN_SUBSCRIPTION_PURCHASED = 4;
/** voidedPurchaseNotification.productType の定期購入 */
export const RTDN_VOIDED_PRODUCT_TYPE_SUBSCRIPTION = 1;
