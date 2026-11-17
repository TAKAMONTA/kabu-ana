/**
 * 静的エクスポート（Capacitor アプリ用）で @vercel/analytics/next の代わりに使う空の実装。
 * next.config.js の turbopack.resolveAlias で差し替える。
 * アプリには /_vercel/insights/script.js が無いため、解析コード自体を同梱しない。
 */
export function Analytics(): null {
  return null;
}
