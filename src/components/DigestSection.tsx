"use client";

import { Sunrise } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDigest } from "@/hooks/useDigest";
import type { WatchlistItem } from "@/hooks/useWatchlist";
import { normalizeDisplayText } from "@/lib/displayText";

interface DigestSectionProps {
  items: WatchlistItem[];
}

/** 2026-09-02 → 9月2日 */
function formatDateId(dateId: string): string {
  const m = dateId.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${Number(m[1])}月${Number(m[2])}日`;
}

export function DigestSection({ items }: DigestSectionProps) {
  const codes = items.map(item => item.code);
  const { status, digest, retry } = useDigest(codes);

  // 0銘柄・未取得・サーバー側 empty はセクションごと出さない
  // （登録への案内は WatchlistSection が担う）
  if (items.length === 0 || status === "idle" || status === "empty") {
    return null;
  }

  const dateLabel = digest?.dateId ? formatDateId(digest.dateId) : "";
  const title = dateLabel ? `${dateLabel}の朝ダイジェスト` : "朝ダイジェスト";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sunrise className="w-4 h-4" />
          {title}
        </CardTitle>
        {items.length > 10 && (
          <p className="text-xs text-muted-foreground">
            登録の新しい10銘柄を要約しています
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {(status === "loading" || status === "generating") && (
          <p className="text-sm text-muted-foreground py-2">
            今日のダイジェストを作成しています…
          </p>
        )}

        {status === "error" && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
            <div className="flex items-center justify-between gap-2">
              <span>今日は作成できませんでした</span>
              <button
                type="button"
                onClick={retry}
                className="text-xs underline"
              >
                再試行
              </button>
            </div>
          </div>
        )}

        {status === "ready" && digest && (
          <div className="space-y-3">
            <p className="text-sm">{digest.marketLine}</p>
            <ul className="space-y-2">
              {digest.stockLines.map(line => (
                <li key={line.code} className="text-sm">
                  <span className="font-medium">
                    {normalizeDisplayText(line.name)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums ml-1">
                    {line.code}
                  </span>
                  <span className="block text-muted-foreground">
                    {line.line}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-sm">{digest.focusLine}</p>
            <p className="text-xs text-muted-foreground">
              AIによる情報整理であり、投資助言ではありません
              {digest.asOf ? ` ・ 株価は${digest.asOf}時点` : ""}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
