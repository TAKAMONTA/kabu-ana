import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** 法務ページ・404 などから一面へ戻るリンク（タップしやすい高さを確保） */
export function BackToHomeLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      ホームへ戻る
    </Link>
  );
}
