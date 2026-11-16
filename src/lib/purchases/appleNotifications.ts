import crypto from "crypto";
import {
  Environment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";

/**
 * App Store Server Notifications v2 の署名検証。
 *
 * 署名付きペイロード（JWS）の x5c 証明書チェーンを Apple Root CA - G3 まで検証し、
 * bundleId・appAppleId（本番のみ）・environment を照合する。検証には Apple 公式の
 * @apple/app-store-server-library（SignedDataVerifier）を使う。
 */

/**
 * Apple Root CA - G3（https://www.apple.com/certificateauthority/AppleRootCA-G3.cer）。
 * 公開証明書なので秘密情報ではない。有効期限 2039-04-30。
 */
const APPLE_ROOT_CA_G3_BASE64 = [
  "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS",
  "QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u",
  "IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN",
  "MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS",
  "b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y",
  "aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49",
  "AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf",
  "TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517",
  "IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr",
  "MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA",
  "MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4",
  "at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM",
  "6BgD56KyKA==",
].join("");

/** Apple が公開している Apple Root CA - G3 の SHA-256 フィンガープリント */
export const APPLE_ROOT_CA_G3_SHA256 =
  "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179";

/** 埋め込んだルート証明書が改変されていないことを確かめてから返す */
export function appleRootCertificates(): Buffer[] {
  const der = Buffer.from(APPLE_ROOT_CA_G3_BASE64, "base64");
  const fingerprint = crypto.createHash("sha256").update(der).digest("hex");
  if (fingerprint !== APPLE_ROOT_CA_G3_SHA256) {
    throw new AppleNotificationConfigError(
      "Apple Root CA - G3 のフィンガープリントが一致しません"
    );
  }
  return [der];
}

/** 通知の形式・署名が不正（再送されても通らない） */
export class AppleNotificationVerificationError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "AppleNotificationVerificationError";
  }
}

/** サーバー側の設定不備（環境変数の未設定など） */
export class AppleNotificationConfigError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "AppleNotificationConfigError";
  }
}

/**
 * subscriptions/{uid} を再検証して書き直す通知の種類。
 * 指定の7種に加え、返金の取り消し（REFUND_REVERSED）も利用可否が変わるので反映する。
 */
export const HANDLED_APPLE_NOTIFICATION_TYPES: ReadonlySet<string> = new Set([
  "SUBSCRIBED",
  "DID_RENEW",
  "EXPIRED",
  "DID_FAIL_TO_RENEW",
  "GRACE_PERIOD_EXPIRED",
  "REFUND",
  "REVOKE",
  "REFUND_REVERSED",
]);

type SupportedEnvironment = Environment.PRODUCTION | Environment.SANDBOX;

/**
 * 署名検証の前に、検証に使う環境だけを読む（どちらの環境で検証するかを決めるため）。
 * 値は SignedDataVerifier が署名検証後に改めて照合する。
 * Xcode / ローカルテスト環境の通知は署名検証が省略されるため受け付けない。
 */
export function peekNotificationEnvironment(
  signedPayload: string
): SupportedEnvironment {
  const segments = signedPayload.split(".");
  if (segments.length !== 3) {
    throw new AppleNotificationVerificationError("signedPayload が JWS 形式ではありません");
  }
  type EnvironmentHolder = { environment?: unknown } | undefined;
  let payload: {
    data?: EnvironmentHolder;
    summary?: EnvironmentHolder;
    appData?: EnvironmentHolder;
  } | null;
  try {
    payload = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
  } catch {
    throw new AppleNotificationVerificationError("signedPayload を解析できません");
  }
  const environment =
    payload?.data?.environment ??
    payload?.summary?.environment ??
    payload?.appData?.environment;
  if (environment === Environment.PRODUCTION) return Environment.PRODUCTION;
  if (environment === Environment.SANDBOX) return Environment.SANDBOX;
  throw new AppleNotificationVerificationError(
    `未対応の通知環境です: ${String(environment).slice(0, 20)}`
  );
}

export interface AppleNotificationConfig {
  bundleId: string;
  appAppleId?: number;
  /** 証明書の失効確認（OCSP）と現在時刻での有効期限確認を行う */
  enableOnlineChecks: boolean;
}

export function readAppleNotificationConfig(): AppleNotificationConfig {
  const rawAppAppleId = process.env.APP_STORE_APP_APPLE_ID?.trim();
  const appAppleId = rawAppAppleId ? Number(rawAppAppleId) : undefined;
  if (appAppleId !== undefined && !Number.isSafeInteger(appAppleId)) {
    throw new AppleNotificationConfigError(
      "APP_STORE_APP_APPLE_ID が数値ではありません"
    );
  }
  return {
    bundleId: process.env.IOS_BUNDLE_ID || "com.takaapps.kabunavi",
    appAppleId,
    enableOnlineChecks: process.env.APPLE_NOTIFICATIONS_ONLINE_CHECKS !== "false",
  };
}

export interface VerifiedAppleNotification {
  notification: ResponseBodyV2DecodedPayload;
  environment: SupportedEnvironment;
  /** data.signedTransactionInfo があれば検証済みの取引情報 */
  transaction?: JWSTransactionDecodedPayload;
}

function createVerifier(
  config: AppleNotificationConfig,
  environment: SupportedEnvironment
): SignedDataVerifier {
  if (environment === Environment.PRODUCTION && config.appAppleId === undefined) {
    // 本番の通知は appAppleId の照合が必須（ライブラリもコンストラクタで例外を出す）
    throw new AppleNotificationConfigError(
      "APP_STORE_APP_APPLE_ID が設定されていません"
    );
  }
  return new SignedDataVerifier(
    appleRootCertificates(),
    config.enableOnlineChecks,
    environment,
    config.bundleId,
    config.appAppleId
  );
}

/**
 * signedPayload を検証・デコードする。
 * @throws AppleNotificationVerificationError 署名・証明書チェーン・bundleId・環境の不一致
 * @throws AppleNotificationConfigError 設定不備
 */
export async function verifyAppleNotification(
  signedPayload: string,
  config: AppleNotificationConfig = readAppleNotificationConfig()
): Promise<VerifiedAppleNotification> {
  const environment = peekNotificationEnvironment(signedPayload);
  const verifier = createVerifier(config, environment);

  let notification: ResponseBodyV2DecodedPayload;
  try {
    notification = await verifier.verifyAndDecodeNotification(signedPayload);
  } catch (error) {
    throw new AppleNotificationVerificationError(
      `通知の署名検証に失敗しました: ${describeVerificationError(error)}`
    );
  }

  const signedTransactionInfo = notification.data?.signedTransactionInfo;
  if (!signedTransactionInfo) {
    return { notification, environment };
  }
  try {
    const transaction = await verifier.verifyAndDecodeTransaction(
      signedTransactionInfo
    );
    return { notification, environment, transaction };
  } catch (error) {
    throw new AppleNotificationVerificationError(
      `取引情報の署名検証に失敗しました: ${describeVerificationError(error)}`
    );
  }
}

/** VerificationException は status（数値）だけを持つ。ログ用に短い説明にする */
function describeVerificationError(error: unknown): string {
  if (error && typeof error === "object" && "status" in error) {
    return `status=${String((error as { status: unknown }).status)}`;
  }
  return error instanceof Error ? error.name : "unknown";
}
