import crypto from "crypto";
import type { NextRequest } from "next/server";
import { getClientIP } from "@/lib/utils/dailyUsageLimiter";
import { sanitizeError } from "@/lib/utils/logSanitizer";

/**
 * AIバンドルトークン。
 * /api/analyze（1回分として数える）の直後に自動で走る財務評価・ニュース分析を
 * 日次上限から除外するための、HMAC 署名付きの短命トークン。
 *
 * 悪用を防ぐための制約:
 * - IP・銘柄（symbol）・用途（action）に束縛する（別銘柄の分析には使えない）
 * - 署名は timingSafeEqual で比較する
 * - 1トークン1回限り（jti を Firestore の ai_bundle_tokens/{jti} に create で記録。
 *   既にあれば再利用として拒否）。Firestore が使えないときは fail-closed
 *   （＝バンドル扱いにせず通常どおり回数に数える。dailyUsageLimiter の
 *   「判定できなければ無料扱い」と同じ方針）
 */

export type BundleAction = "financial" | "news";

interface BundlePayload {
  ip: string;
  symbol: string;
  action: BundleAction;
  exp: number;
  jti: string;
}

const BUNDLE_TOKEN_TTL_MS = 15 * 60 * 1000;
export const AI_BUNDLE_TOKENS_COLLECTION = "ai_bundle_tokens";

const PLACEHOLDER_SECRETS = new Set([
  "your_ai_bundle_token_secret_here",
  "your_openrouter_api_key_here",
  "your_openrouter_key_here",
]);

/**
 * 署名鍵。AI_BUNDLE_TOKEN_SECRET を優先し、未設定なら OPENROUTER_API_KEY を使う
 * （.env.example にこのフォールバックが明記されており、本番がこれに依存している可能性が
 * あるため維持する）。どちらも無ければ null（バンドル無効＝通常どおり回数に数える）。
 * 以前あった固定文字列 "dev-ai-bundle-secret" へのフォールバックは、誰でもトークンを
 * 偽造できるので廃止した。
 */
function getBundleSecret(): string | null {
  for (const candidate of [
    process.env.AI_BUNDLE_TOKEN_SECRET,
    process.env.OPENROUTER_API_KEY,
  ]) {
    if (candidate && !PLACEHOLDER_SECRETS.has(candidate)) return candidate;
  }
  return null;
}

function signPayload(payloadB64: string, secret: string): Buffer {
  return crypto.createHmac("sha256", secret).update(payloadB64).digest();
}

/** 銘柄の表記ゆれ（前後空白・大小文字）を吸収して比較する */
export function normalizeBundleSymbol(symbol: unknown): string {
  return typeof symbol === "string" ? symbol.trim().toUpperCase() : "";
}

/**
 * トークンを発行する。署名鍵が無い環境では null（バンドルしない）。
 */
export function createAiBundleToken(
  ip: string,
  symbol: string,
  action: BundleAction
): string | null {
  const secret = getBundleSecret();
  if (!secret) return null;
  const payload: BundlePayload = {
    ip,
    symbol: normalizeBundleSymbol(symbol),
    action,
    exp: Date.now() + BUNDLE_TOKEN_TTL_MS,
    jti: crypto.randomUUID(),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${signPayload(payloadB64, secret).toString("base64url")}`;
}

/**
 * 署名・期限・用途・IP・銘柄を検証し、通ればペイロードを返す（使用済み判定はしない）。
 */
export function verifyAiBundleToken(
  token: string,
  request: NextRequest,
  action: BundleAction,
  symbol: unknown
): BundlePayload | null {
  try {
    const secret = getBundleSecret();
    if (!secret) return null;

    const [payloadB64, signature, ...rest] = token.split(".");
    if (!payloadB64 || !signature || rest.length > 0) return null;

    const expected = signPayload(payloadB64, secret);
    const provided = Buffer.from(signature, "base64url");
    if (
      provided.length !== expected.length ||
      !crypto.timingSafeEqual(provided, expected)
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as Partial<BundlePayload>;

    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (payload.action !== action) return null;
    if (payload.ip !== getClientIP(request)) return null;
    const requestSymbol = normalizeBundleSymbol(symbol);
    if (!requestSymbol || payload.symbol !== requestSymbol) return null;
    if (typeof payload.jti !== "string" || !payload.jti) return null;

    return payload as BundlePayload;
  } catch {
    return null;
  }
}

/** 同一インスタンス内での再利用を Firestore に問い合わせる前に弾く（ベストエフォート） */
const locallyConsumed = new Map<string, number>();

function rememberLocally(jti: string, exp: number): void {
  const now = Date.now();
  for (const [key, expiry] of locallyConsumed) {
    if (expiry < now) locallyConsumed.delete(key);
  }
  locallyConsumed.set(jti, exp);
}

/** テスト用: インスタンス内の使用済み記録を消す */
export function resetBundleTokenMemoryForTests(): void {
  locallyConsumed.clear();
}

async function getBundleTokenDb() {
  try {
    const { getAdminApp } = await import("@/lib/firebase/admin");
    const { getFirestore } = await import("firebase-admin/firestore");
    return getFirestore(getAdminApp());
  } catch {
    return null;
  }
}

function isAlreadyExistsError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  // gRPC の ALREADY_EXISTS は 6
  return code === 6 || code === "already-exists" || code === "ALREADY_EXISTS";
}

/**
 * トークンを使用済みにする。初回だけ true。
 * Firestore に記録できない場合は false（fail-closed）。
 */
export async function consumeAiBundleToken(
  payload: BundlePayload
): Promise<boolean> {
  if (locallyConsumed.has(payload.jti)) return false;

  const db = await getBundleTokenDb();
  if (!db) {
    console.error(
      "aiBundleToken: Firestore を利用できないため、バンドルトークンを無効として扱います"
    );
    return false;
  }

  try {
    await db
      .collection(AI_BUNDLE_TOKENS_COLLECTION)
      .doc(payload.jti)
      .create({
        action: payload.action,
        // Firestore の TTL ポリシーをこのフィールドに設定すれば自動で掃除される
        expiresAt: new Date(payload.exp),
        usedAt: new Date(),
      });
    rememberLocally(payload.jti, payload.exp);
    return true;
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      rememberLocally(payload.jti, payload.exp);
      return false;
    }
    console.error(
      `aiBundleToken: 使用記録の保存に失敗したため無効として扱います: ${sanitizeError(error)}`
    );
    return false;
  }
}

/** リクエスト本文から銘柄を読む（本文はハンドラーでも読むので clone する） */
async function readSymbolFromBody(request: NextRequest): Promise<unknown> {
  const body = await request
    .clone()
    .json()
    .catch(() => null);
  return body && typeof body === "object"
    ? (body as Record<string, unknown>).symbol
    : undefined;
}

/**
 * withDailyLimit の skip に渡す判定関数を作る。
 * 有効なトークン（IP・銘柄・用途が一致し、未使用）のときだけ true。
 */
export function createBundledSkip(
  action: BundleAction,
  readSymbol: (request: NextRequest) => Promise<unknown> = readSymbolFromBody
) {
  return async (request: NextRequest): Promise<boolean> => {
    const token = request.headers.get("x-ai-bundle-token");
    if (!token) return false;
    const payload = verifyAiBundleToken(
      token,
      request,
      action,
      await readSymbol(request)
    );
    if (!payload) return false;
    return consumeAiBundleToken(payload);
  };
}
