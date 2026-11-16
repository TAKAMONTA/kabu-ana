import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { APP_NAME } from "@/lib/constants";

// robots の noindex は Next.js が 404 に自動で付ける
export const metadata: Metadata = {
  title: "ページが見つかりません",
};

/**
 * 存在しない URL を開いたときの画面。
 * 静的エクスポート（Capacitor）でも 404.html として出力されるよう、
 * サーバー専用の処理やデータ取得は使わない。
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)]">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8 text-center">
          <SearchX className="size-12 text-muted-foreground" aria-hidden />
          <div className="space-y-2">
            <h1 className="text-xl font-bold">ページが見つかりません</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {
                "お探しのページは移動したか、削除された可能性があります。URLをご確認のうえ、トップページからお探しください。"
              }
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {APP_NAME} のトップへ戻る
          </Link>
          <Link
            href="/signals"
            className="inline-flex min-h-11 items-center text-sm text-primary hover:underline"
          >
            マーケット・シグナルを見る
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
