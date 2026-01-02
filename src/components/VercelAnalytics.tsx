"use client";

// Vercelのビルド環境で@vercel/analyticsが解決できないため一時的に無効化
// 本番環境ではVercelが自動的にアナリティクスを提供
export function VercelAnalytics() {
  return null;
}

