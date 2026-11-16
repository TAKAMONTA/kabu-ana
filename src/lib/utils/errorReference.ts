/**
 * エラー画面に出す「参照番号」を取り出す。
 * Next.js がサーバー側のエラーに付ける error.digest だけを使い、
 * エラーメッセージなどの詳細は画面に出さない。
 * 英数字と記号以外を含む・長すぎるなど想定外の値は出さない。
 */
export function getErrorReference(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("digest" in error)) return null;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== "string") return null;
  const trimmed = digest.trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(trimmed)) return null;
  return trimmed;
}
