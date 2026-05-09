import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PanelLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

export function PanelError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>{error}</span>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" />
          再取得
        </Button>
      )}
    </div>
  );
}

export function formatRelativeTime(iso?: string | null) {
  if (!iso) return "未取得";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  return `${Math.floor(minutes / 60)}時間前`;
}
