"use client";

import { useEffect } from "react";
import { APP_NAME } from "@/lib/constants";
import { getErrorReference } from "@/lib/utils/errorReference";

type GlobalErrorProps = {
  error: unknown;
  reset: () => void;
  retry?: () => void;
};

// ルートレイアウトごと置き換わるため globals.css（Tailwind）は効かない。
// 最小限のスタイルをここに直接書き、OS のダークモードにも合わせる。
const styles = `
  .ge-body { margin: 0; font-family: system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif;
    background: #ffffff; color: #020817; }
  .ge-main { display: flex; min-height: 100vh; align-items: center; justify-content: center; box-sizing: border-box;
    padding: calc(env(safe-area-inset-top) + 2rem) 1rem calc(env(safe-area-inset-bottom) + 2rem); }
  .ge-card { width: 100%; max-width: 28rem; box-sizing: border-box; border: 1px solid #e2e8f0; border-radius: 0.75rem;
    padding: 2rem 1.5rem; text-align: center; background: #ffffff; }
  .ge-title { margin: 0 0 0.5rem; font-size: 1.25rem; font-weight: 700; }
  .ge-text { margin: 0 0 0.5rem; font-size: 0.875rem; line-height: 1.7; color: #64748b; }
  .ge-ref { margin: 0 0 0.5rem; font-size: 0.75rem; color: #64748b; }
  .ge-actions { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; margin-top: 1rem; }
  .ge-button { min-height: 44px; padding: 0 1.5rem; border: none; border-radius: 0.375rem; background: #2563eb;
    color: #f8fafc; font-size: 0.875rem; font-weight: 500; cursor: pointer; }
  .ge-link { display: inline-flex; align-items: center; min-height: 44px; font-size: 0.875rem; color: #2563eb; }
  @media (prefers-color-scheme: dark) {
    .ge-body, .ge-card { background: #020817; color: #f8fafc; }
    .ge-card { border-color: #1e293b; }
    .ge-text, .ge-ref { color: #94a3b8; }
    .ge-button { background: #3b82f6; color: #020817; }
    .ge-link { color: #60a5fa; }
  }
`;

/**
 * ルートレイアウト自体でエラーが起きたときの最後の受け皿。
 * 独自の <html>・<body> を持つ必要がある。エラーの詳細は画面に出さない。
 */
export default function GlobalError({ error, reset, retry }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const reference = getErrorReference(error);

  return (
    <html lang="ja">
      <body className="ge-body">
        <title>{`エラーが発生しました | ${APP_NAME}`}</title>
        <style>{styles}</style>
        <main className="ge-main">
          <div className="ge-card" role="alert">
            <h1 className="ge-title">うまく表示できませんでした</h1>
            <p className="ge-text">
              一時的な不具合の可能性があります。少し時間をおいて、もう一度お試しください。
            </p>
            {reference && <p className="ge-ref">参照番号: {reference}</p>}
            <div className="ge-actions">
              <button
                type="button"
                className="ge-button"
                onClick={() => (retry ?? reset)()}
              >
                もう一度試す
              </button>
              {/* ルートレイアウトが壊れている可能性があるため、ページ全体を読み込み直して戻る */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a className="ge-link" href="/">
                {APP_NAME} のトップへ戻る
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
