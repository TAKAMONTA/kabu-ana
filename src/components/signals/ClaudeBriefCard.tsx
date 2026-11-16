"use client";

import { Brain, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubscription } from "@/hooks/useSubscription";
import { useClaudeBrief } from "@/hooks/signals/useClaudeBrief";
import { PanelError, PanelLoading, formatRelativeTime } from "./PanelState";

/** risk_outlook（low/elevated/high/critical）を初心者向けの日本語にする */
const RISK_OUTLOOK_JA: Record<string, { label: string; className: string }> = {
  low: { label: "低め", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  elevated: { label: "やや高め", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  high: { label: "高め", className: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300" },
  critical: { label: "非常に高い", className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
};

/** 注目銘柄の direction（up/down/watch）を日本語にする */
const DIRECTION_JA: Record<string, string> = {
  up: "上向き",
  down: "下向き",
  watch: "様子見",
};

export function ClaudeBriefCard() {
  const { isPremium, loading: subscriptionLoading } = useSubscription();
  const { data, error, isLoading, lastSuccessfulAt, refresh, deepDive, deepDiveError, isDeepDiveLoading, requestDeepDive } = useClaudeBrief();
  const brief = data?.brief;

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="inline-flex items-center gap-2"><Brain className="size-4" />Claude 市場ブリーフ</span>
          <span className="text-xs font-normal text-muted-foreground">最終更新: {formatRelativeTime(data?.generatedAt ?? lastSuccessfulAt)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <PanelLoading rows={4} /> : error && !data ? <PanelError error={error} onRetry={refresh} /> : !brief ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            今日のブリーフはまだ作成されていません。時間をおいて再度ご確認ください。
          </p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border bg-background p-4">
              <div className="text-lg font-semibold">{brief.headline_jp}</div>
              <p className="mt-2 text-sm text-muted-foreground">{brief.summary_jp}</p>
              <div className={`mt-3 inline-flex rounded px-2 py-1 text-xs font-medium ${RISK_OUTLOOK_JA[brief.risk_outlook]?.className ?? "bg-secondary"}`}>
                リスクの見通し: {RISK_OUTLOOK_JA[brief.risk_outlook]?.label ?? brief.risk_outlook}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-2 text-sm font-medium">主要ドライバー</div>
                <div className="space-y-2">
                  {brief.key_drivers.map((item, index) => (
                    <div key={index} className="rounded-md border p-3 text-sm">
                      <div className="font-medium">{item.factor}</div>
                      <div className="text-muted-foreground">{item.impact}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-medium">注目銘柄</div>
                <div className="space-y-2">
                  {brief.stocks_to_watch.map((item) => (
                    <div key={item.ticker} className="rounded-md border p-3 text-sm">
                      <div className="font-medium">{item.ticker} <span className="text-xs text-muted-foreground">{DIRECTION_JA[item.direction] ?? item.direction}</span></div>
                      <div className="text-muted-foreground">{item.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {isPremium ? (
              <Button disabled={isDeepDiveLoading} onClick={() => requestDeepDive({ brief })}>
                {isDeepDiveLoading ? "分析中..." : "深掘り分析"}
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                <Lock className="size-4" />
                {subscriptionLoading ? "購入状態を確認中..." : "深掘り分析はプレミアム限定です"}
              </div>
            )}
            {deepDiveError && <PanelError error={deepDiveError} />}
            {deepDive && (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium">なぜ動いた</div>
                  {deepDive.causes.map((item, index) => (
                    <div key={index} className="rounded-md border p-3 text-sm"><b>{item.hypothesis}</b><p className="text-muted-foreground">{item.rationale}</p></div>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">次に起きそうなこと</div>
                  {deepDive.scenarios.map((item, index) => (
                    <div key={index} className="rounded-md border p-3 text-sm"><b>{item.scenario}</b><p className="text-muted-foreground">{item.trigger}</p></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {error && data && <div className="mt-3"><PanelError error={error} onRetry={refresh} /></div>}
      </CardContent>
    </Card>
  );
}
