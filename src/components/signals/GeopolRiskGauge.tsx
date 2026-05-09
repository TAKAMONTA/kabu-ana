"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGeopolRisk } from "@/hooks/signals/useGeopolRisk";
import { PanelError, PanelLoading, formatRelativeTime } from "./PanelState";

const labels = {
  geopol: "地政学",
  energy: "エネルギー",
  maritime: "海運",
  disaster: "災害",
  cyber: "サイバー",
} as const;

export function GeopolRiskGauge() {
  const { data, error, isLoading, lastSuccessfulAt, refresh } = useGeopolRisk();
  const radarData = data?.risk
    ? Object.entries(data.risk).map(([key, value]) => ({ dimension: labels[key as keyof typeof labels], score: value }))
    : [];

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          投資環境リスクメーター
          <span className="text-xs font-normal text-muted-foreground">最終更新: {formatRelativeTime(data?.calculatedAt ?? lastSuccessfulAt)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <PanelLoading rows={4} /> : error && !data ? <PanelError error={error} onRetry={refresh} /> : data && !data.baselineReady ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">ベースライン収集中</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="flex flex-col justify-center rounded-md border bg-background p-5 text-center">
              <div className="text-xs text-muted-foreground">Composite</div>
              <div className="mt-2 text-5xl font-semibold">{data?.composite?.toFixed(1) ?? "--"}</div>
              <div className="mt-2 text-xs text-muted-foreground">0-10</div>
            </div>
            <div className="h-72 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10 }} />
                  <Radar dataKey="score" stroke="#0f766e" fill="#14b8a6" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {error && data && <div className="mt-3"><PanelError error={error} onRetry={refresh} /></div>}
      </CardContent>
    </Card>
  );
}
