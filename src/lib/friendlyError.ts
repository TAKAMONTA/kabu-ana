/**
 * 画面に出すエラー文を、利用者が次に何をすればよいか分かる日本語へ寄せる。
 * サーバーが返す日本語メッセージはそのまま活かし、
 * ブラウザ由来の英語（"Failed to fetch" 等）や技術的な文言だけを置き換える。
 */

const NETWORK_PATTERN =
  /failed to fetch|networkerror|network request failed|network error|load failed|err_internet|err_network|offline/i;
const TIMEOUT_PATTERN = /timeout|timed out|aborted/i;
const RATE_LIMIT_PATTERN = /\b429\b|too many requests|rate limit|レート制限/i;
const JAPANESE_PATTERN = /[぀-ヿ一-龯]/;

export const NETWORK_ERROR_MESSAGE =
  "通信できませんでした。電波状況を確認して、もう一度お試しください。";
export const TIMEOUT_ERROR_MESSAGE =
  "応答に時間がかかっています。少し待ってから、もう一度お試しください。";
export const RATE_LIMIT_ERROR_MESSAGE =
  "アクセスが集中しています。1分ほど待ってから、もう一度お試しください。";

export function toFriendlyErrorMessage(
  raw: string | null | undefined,
  fallback: string
): string {
  const message = (raw ?? "").trim();
  if (!message) return fallback;
  if (RATE_LIMIT_PATTERN.test(message)) return RATE_LIMIT_ERROR_MESSAGE;
  if (NETWORK_PATTERN.test(message)) return NETWORK_ERROR_MESSAGE;
  if (TIMEOUT_PATTERN.test(message)) return TIMEOUT_ERROR_MESSAGE;
  if (JAPANESE_PATTERN.test(message)) return message;
  return fallback;
}
