import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Capacitor / ネイティブ WebView は file:// や capacitor:// のため本番 API とオリジンが異なる。
 * fetch が CORS でブロックされ iOS では「Load failed」になるため、公開 API に CORS を付与する。
 */
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With, X-API-Key",
};

export function middleware(request: NextRequest) {
  // プリフライトのみここで処理（GET 等の CORS は next.config.js の headers で付与）
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
