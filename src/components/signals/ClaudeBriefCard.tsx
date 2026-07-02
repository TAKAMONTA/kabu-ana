"use client";

import Link from "next/link";
import { Brain, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubscription } from "@/hooks/useSubscription";
import { useClaudeBrief } from "@/hooks/signals/useClaudeBrief";
import { PanelError, PanelLoading, formatRelativeTime } from "./PanelState";

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
        {isLoading ? <PanelLoading rows={4} /> : error && !data ? <PanelError error={error} onRetry={refresh} /> : brief && (
          <div className="space-y-4">
            <div className="rounded-md border bg-background p-4">
              <div className="text-lg font-semibold">{brief.headline_jp}</div>
              <p className="mt-2 text-sm text-muted-foreground">{brief.summary_jp}</p>
              <div className="mt-3 inline-flex rounded bg-secondary px-2 py-1 text-xs">outlook: {brief.risk_outlook}</div>
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
                      <div className="font-medium">{item.ticker} <span className="text-xs text-muted-foreground">{item.direction}</span></div>
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
              <div className="flex flex-col gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
                <span className="flex items-center gap-2">
                  <Lock className="size-4 shrink-0" />
                  {subscriptionLoading ? "購入状態を確認中..." : "深掘り分析はプレミアム限定です"}
                </span>
                {!subscriptionLoading && (
                  <Link
                    href="/"
                    className="text-xs font-semibold text-primary underline underline-offset-2 sm:ml-auto"
                  >
                    プレミアムに登録 →
                  </Link>
                )}
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
