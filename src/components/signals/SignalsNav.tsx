"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { BarChart3, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";

export function SignalsNav({
  active,
  onHomeClick,
}: {
  active: "home" | "signals";
  /**
   * ホーム画面上で「銘柄分析」を押したときの処理。同じ "/" へのリンクは
   * 画面が切り替わらないため、検索結果を閉じて一面に戻すのに使う
   */
  onHomeClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const itemClass = (selected: boolean) =>
    cn(
      "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
      selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
    );

  return (
    <nav className="flex items-center gap-2">
      <Link
        href="/"
        className={itemClass(active === "home")}
        aria-current={active === "home" ? "page" : undefined}
        onClick={active === "home" ? onHomeClick : undefined}
      >
        <LineChart className="size-4" />
        銘柄分析
      </Link>
      <Link
        href="/signals"
        className={itemClass(active === "signals")}
        aria-current={active === "signals" ? "page" : undefined}
      >
        <BarChart3 className="size-4" />
        マーケット・シグナル
      </Link>
    </nav>
  );
}
