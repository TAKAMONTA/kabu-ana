/** 銘柄コードの最大長。日本株4桁・英数字混在コード・米国ティッカーを収める */
const MAX_CODE_LENGTH = 20;

/** Firestore の docId として安全な形。先頭は英数字に限る */
const SAFE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9.-]*$/;

/**
 * 銘柄コードを正規化する。
 * NFKC で全角を畳み、trim して大文字化する。
 * Firestore の docId に使えない文字を含む場合や長すぎる場合は null を返す。
 * 銘柄が実在するかは検証しない（形式だけを見る）。
 */
export function normalizeWatchlistCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.normalize("NFKC").trim().toUpperCase();
  if (!normalized) return null;
  if (normalized.length > MAX_CODE_LENGTH) return null;
  if (!SAFE_CODE_PATTERN.test(normalized)) return null;
  return normalized;
}

/**
 * `?codes=7203,6758` の値を配列にする。
 * 不正なコードは捨て、重複を除き、max 件で打ち切る。
 */
export function parseCodesParam(
  raw: string | null,
  max: number = 20
): string[] {
  if (!raw) return [];
  if (!Number.isFinite(max) || max <= 0) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    if (seen.size >= max) break;
    const code = normalizeWatchlistCode(part);
    if (code) seen.add(code);
  }
  return Array.from(seen);
}
