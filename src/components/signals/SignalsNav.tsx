"use client";

import Link from "next/link";
import { BarChart3, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";

export function SignalsNav({ active }: { active: "home" | "signals" }) {
  const itemClass = (selected: boolean) =>
    cn(
      "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
      selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
    );

  return (
    <nav className="flex items-center gap-2">
      <Link href="/" className={itemClass(active === "home")}>
        <LineChart className="size-4" />
        銘柄分析
      </Link>
      <Link href="/signals" className={itemClass(active === "signals")}>
        <BarChart3 className="size-4" />
        マーケット・シグナル
      </Link>
    </nav>
  );
}
