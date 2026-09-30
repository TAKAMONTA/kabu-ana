"use client";

import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DataStatusItem } from "@/lib/dataStatus";

interface DataStatusCardProps {
  items: DataStatusItem[];
  /** サーバーがデータを取得した時刻（ISO 8601） */
  fetchedAt?: string;
  isRetrying?: boolean;
  onRetry?: () => void;
}

function formatFetchedTime(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function DataStatusCard({
  items,
  fetchedAt,
  isRetrying = false,
  onRetry,
}: DataStatusCardProps) {
  const fetchedLabel = formatFetchedTime(fetchedAt);
  const missing = items.filter(item => item.state === "missing");

  return (
    <section
      aria-label="データの取得状況"
      className="mb-6 rounded-lg border bg-card p-3 sm:p-4"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">データの取得状況</h3>
        {fetchedLabel && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {fetchedLabel} 取得
          </span>
        )}
      </div>

      <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {items.map(item => (
          <li
            key={item.key}
            className={`flex min-w-0 items-start gap-2 rounded-md border px-2.5 py-2 ${
              item.state === "ok"
                ? "border-border bg-background"
                : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
            }`}
          >
            {item.state === "ok" ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-label="取得済み"
              />
            ) : (
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                aria-label="未取得"
              />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold">{item.label}</p>
              <p className="text-xs leading-snug text-muted-foreground break-words">
                {item.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {missing.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            取得できなかった情報（{missing.map(item => item.label).join("・")}
            ）は画面表示とAI分析に含まれていません。
          </p>
          {onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={onRetry}
              disabled={isRetrying}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`}
              />
              再取得
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
