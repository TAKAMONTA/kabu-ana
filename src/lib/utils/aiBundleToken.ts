import crypto from "crypto";
import type { NextRequest } from "next/server";
import { getClientIP } from "@/lib/utils/dailyUsageLimiter";

export type BundleAction = "financial" | "news";

interface BundlePayload {
  ip: string;
  symbol: string;
  action: BundleAction;
  exp: number;
}

const BUNDLE_TOKEN_TTL_MS = 15 * 60 * 1000;

function getBundleSecret(): string {
  return (
    process.env.AI_BUNDLE_TOKEN_SECRET ||
    process.env.OPENROUTER_API_KEY ||
    "dev-ai-bundle-secret"
  );
}

function signPayload(payloadB64: string): string {
  return crypto
    .createHmac("sha256", getBundleSecret())
    .update(payloadB64)
    .digest("base64url");
}

export function createAiBundleToken(
  ip: string,
  symbol: string,
  action: BundleAction
): string {
  const payload: BundlePayload = {
    ip,
    symbol,
    action,
    exp: Date.now() + BUNDLE_TOKEN_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${signPayload(payloadB64)}`;
}

export function verifyAiBundleToken(
  token: string,
  request: NextRequest,
  action: BundleAction
): boolean {
  try {
    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) return false;
    if (signature !== signPayload(payloadB64)) return false;

    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as BundlePayload;

    if (payload.exp < Date.now()) return false;
    if (payload.action !== action) return false;
    if (payload.ip !== getClientIP(request)) return false;

    return true;
  } catch {
    return false;
  }
}

export function createBundledSkip(action: BundleAction) {
  return (request: NextRequest) => {
    const token = request.headers.get("x-ai-bundle-token");
    if (!token) return false;
    return verifyAiBundleToken(token, request, action);
  };
}
