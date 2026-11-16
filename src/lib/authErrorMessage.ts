/**
 * Firebase Authentication のエラーを、画面に出せる日本語へ置き換える。
 * Firebase の message（例: "Firebase: Error (auth/invalid-credential)."）は
 * 英語かつ技術的なので、そのまま画面に出さない。
 */
import { NETWORK_ERROR_MESSAGE } from "@/lib/friendlyError";

export type AuthAction = "login" | "register" | "resetPassword" | "logout";

export const AUTH_UNAVAILABLE_MESSAGE =
  "現在ログイン機能を利用できません。時間をおいてもう一度お試しください。";

const WRONG_CREDENTIALS_MESSAGE = "メールアドレスまたはパスワードが違います。";

const FALLBACK_BY_ACTION: Record<AuthAction, string> = {
  login: "ログインできませんでした。もう一度お試しください。",
  register: "アカウントを作成できませんでした。もう一度お試しください。",
  resetPassword:
    "パスワード再設定メールを送信できませんでした。もう一度お試しください。",
  logout: "ログアウトできませんでした。もう一度お試しください。",
};

const MESSAGE_BY_CODE: Record<string, string> = {
  "auth/invalid-credential": WRONG_CREDENTIALS_MESSAGE,
  "auth/invalid-login-credentials": WRONG_CREDENTIALS_MESSAGE,
  "auth/wrong-password": WRONG_CREDENTIALS_MESSAGE,
  "auth/user-not-found": WRONG_CREDENTIALS_MESSAGE,
  "auth/email-already-in-use":
    "このメールアドレスはすでに登録されています。「ログイン」からお試しください。",
  "auth/weak-password": "パスワードは6文字以上で設定してください。",
  "auth/invalid-email": "メールアドレスの形式が正しくありません。",
  "auth/missing-email": "メールアドレスを入力してください。",
  "auth/missing-password": "パスワードを入力してください。",
  "auth/too-many-requests":
    "短時間に何度も試されたため、一時的に操作を止めています。しばらく待ってからもう一度お試しください。",
  "auth/network-request-failed": NETWORK_ERROR_MESSAGE,
  "auth/user-disabled":
    "このアカウントは現在ご利用いただけません。お問い合わせください。",
  "auth/operation-not-allowed": AUTH_UNAVAILABLE_MESSAGE,
  "auth/requires-recent-login":
    "安全のため、もう一度ログインしてからお試しください。",
};

/** パスワード再設定では「パスワードが違います」は意味が通らないため個別に出す */
const RESET_PASSWORD_OVERRIDES: Record<string, string> = {
  "auth/user-not-found":
    "このメールアドレスで登録されたアカウントが見つかりませんでした。",
};

const CODE_IN_MESSAGE = /\b(auth\/[a-z0-9-]+)\b/i;

/** Firebase のエラーオブジェクト（または message 文字列）から auth/xxx コードを取り出す */
export function extractAuthErrorCode(error: unknown): string | null {
  if (error && typeof error === "object") {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.startsWith("auth/")) return code;
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message.match(CODE_IN_MESSAGE)?.[1]?.toLowerCase() ?? null;
    }
    return null;
  }
  if (typeof error === "string") {
    return error.match(CODE_IN_MESSAGE)?.[1]?.toLowerCase() ?? null;
  }
  return null;
}

export function toAuthErrorMessage(error: unknown, action: AuthAction): string {
  const code = extractAuthErrorCode(error);
  if (code) {
    if (action === "resetPassword" && RESET_PASSWORD_OVERRIDES[code]) {
      return RESET_PASSWORD_OVERRIDES[code];
    }
    if (MESSAGE_BY_CODE[code]) return MESSAGE_BY_CODE[code];
  }
  return FALLBACK_BY_ACTION[action];
}
