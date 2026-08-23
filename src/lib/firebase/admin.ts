import { initializeApp, getApps, cert, App } from "firebase-admin/app";

/**
 * Firebase Admin SDK の設定起因の失敗（環境変数未設定・不正な形式・初期化失敗）を表すエラー。
 * トークン検証失敗などの認証エラーとは区別して扱う必要がある呼び出し元は、
 * `instanceof FirebaseAdminConfigError` で判定すること。
 *
 * 注意: 設定エラーのメッセージには、環境変数の値やパースエラーの詳細を絶対に含めないこと
 * （2026-08-16、JSON.parseのエラーメッセージがそのままレスポンスに漏れた障害の再発防止）。
 */
export class FirebaseAdminConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirebaseAdminConfigError";
  }
}

let adminApp: App | null = null;

/**
 * Firebase Admin SDK のアプリインスタンスを取得する（初回のみ初期化）。
 * 設定に起因する失敗は FirebaseAdminConfigError を投げる。
 */
export function getAdminApp(): App {
  if (adminApp) return adminApp;

  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new FirebaseAdminConfigError(
      "FIREBASE_SERVICE_ACCOUNT_KEY が設定されていません"
    );
  }

  let serviceAccount: object;
  try {
    serviceAccount = JSON.parse(serviceAccountKey);
  } catch {
    console.error("Firebase Admin SDK初期化エラー: 環境変数の形式が不正です");
    throw new FirebaseAdminConfigError(
      "FIREBASE_SERVICE_ACCOUNT_KEY の形式が不正です"
    );
  }

  try {
    adminApp = initializeApp({ credential: cert(serviceAccount) });
    return adminApp;
  } catch {
    console.error("Firebase Admin SDK初期化エラー: SDKの初期化に失敗しました");
    throw new FirebaseAdminConfigError(
      "Firebase Admin SDK の初期化に失敗しました"
    );
  }
}
