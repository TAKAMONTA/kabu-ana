"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useGeopolRisk } from "@/hooks/signals/useGeopolRisk";
import { getScoreLabelJa } from "@/lib/signals/localize";

/** サーバーが返す英語・専門用語のラベルを、初心者向けの日本語に置き換える */
const LABEL_JA: Record<string, string> = {
  Composite: "総合スコア",
};

const REASON_JA: Record<string, string> = {
  "リスク次元が7.0以上": "リスクが高い水準（10段階で7以上）",
  "24時間変化が+3.0以上": "24時間で大きく上昇（+3以上）",
  "単一ニュース重みが7.0以上": "影響の大きいニュース",
};

function NeutralCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="rounded-lg">
      <CardContent className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Info className="size-4 shrink-0" />
        <span>{children}</span>
      </CardContent>
    </Card>
  );
}

export function AnomalyTicker() {
  const { data, error, isLoading } = useGeopolRisk();

  // 読み込み中・取得失敗・比較用データ不足のときに「緊急アラートはありません」と
  // 緑で出すと、確認できていないのに問題なしに見えてしまう
  if (isLoading && !data) {
    return (
      <div role="status" aria-live="polite">
        <NeutralCard>緊急アラートを確認しています…</NeutralCard>
      </div>
    );
  }
  if (!data) {
    return (
      <NeutralCard>
        {error
          ? "緊急アラートの状況を取得できませんでした。時間をおいて再度ご確認ください。"
          : "緊急アラートの状況はまだ取得できていません。"}
      </NeutralCard>
    );
  }
  if (!data.baselineReady) {
    return (
      <NeutralCard>
        比較用のデータを集めているため、緊急アラートはまだ判定していません。
      </NeutralCard>
    );
  }

  const anomalies = data.anomalies ?? [];
  if (anomalies.length === 0) {
    return (
      <Card className="rounded-lg border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40">
        <CardContent className="flex items-center gap-2 py-3 text-sm text-green-800 dark:text-green-200">
          <CheckCircle2 className="size-4 shrink-0" />
          現在、緊急アラートはありません
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-lg border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
      <CardContent className="flex items-start gap-3 py-3 text-sm text-red-800 dark:text-red-200">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">緊急アラート {anomalies.length} 件</p>
          {/* スマホで1行に詰めると切れて読めないため、1件ずつ折り返して並べる */}
          <ul className="mt-1 space-y-1">
            {anomalies.map((item, index) => (
              <li key={`${item.label}-${index}`} className="break-words">
                <span className="font-medium">
                  {LABEL_JA[item.label] ?? item.label}
                </span>
                <span className="ml-1 text-xs">
                  （{getScoreLabelJa(item.score)}・
                  {REASON_JA[item.reason] ?? item.reason}）
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
