"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { APP_NAME } from "@/lib/constants";
import { getErrorReference } from "@/lib/utils/errorReference";

type ErrorPageProps = {
  error: unknown;
  /** エラー状態を解除して描画し直す */
  reset: () => void;
  /** 最新のデータを取り直してから描画し直す（Next.js 16 以降） */
  retry?: () => void;
};

/**
 * ページの表示中に想定外のエラーが起きたときの画面。
 * エラーの詳細（メッセージ等）は画面に出さず、開発者向けにコンソールへだけ記録する。
 * 静的エクスポート（Capacitor）でも動くよう、サーバー専用の処理は使わない。
 */
export default function ErrorPage({ error, reset, retry }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const reference = getErrorReference(error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)]">
      <Card className="w-full max-w-md">
        <CardContent
          role="alert"
          className="flex flex-col items-center gap-4 pt-8 pb-8 text-center"
        >
          <AlertTriangle
            className="size-12 text-muted-foreground"
            aria-hidden
          />
          <div className="space-y-2">
            <h1 className="text-xl font-bold">
              うまく表示できませんでした
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {
                "一時的な不具合の可能性があります。少し時間をおいて、もう一度お試しください。"
              }
            </p>
            {reference && (
              <p className="text-xs text-muted-foreground">
                参照番号: {reference}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => (retry ?? reset)()}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            もう一度試す
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-sm text-primary hover:underline"
          >
            {APP_NAME} のトップへ戻る
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
