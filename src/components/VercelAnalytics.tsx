"use client";

import { useSyncExternalStore } from "react";
import { Analytics } from "@vercel/analytics/next";
import { isNativeAppRuntime } from "@/lib/utils/apiClient";

const subscribe = () => () => {};

/**
 * Vercel Web Analytics（Cookie を使わない匿名のアクセス集計）。
 *
 * Web 版（Vercel 上の kabu-ana.com）だけで読み込む。
 * - 静的エクスポート（Capacitor アプリ用）では layout.tsx 側でビルド時に描画しない
 *   （/_vercel/insights/script.js が存在せず 404 になるため）。
 * - 念のため、ネイティブアプリ内で動いているときは実行時にも読み込まない。
 *   サーバー描画とハイドレーション中は false（何も描画しない）にして、
 *   描画結果の食い違いを起こさない。
 */
export function VercelAnalytics() {
  const isWeb = useSyncExternalStore(
    subscribe,
    () => !isNativeAppRuntime(),
    () => false
  );

  if (!isWeb) return null;
  return <Analytics />;
}
