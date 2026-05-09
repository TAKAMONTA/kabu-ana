"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSeismic } from "@/hooks/signals/useSeismic";
import { PanelError, PanelLoading, formatRelativeTime } from "./PanelState";

export function SeismicTable() {
  const { data, error, isLoading, lastSuccessfulAt, refresh } = useSeismic();
  const earthquakes = data?.earthquakes ?? [];

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          直近7日 M4.5+ 地震
          <span className="text-xs font-normal text-muted-foreground">最終更新: {formatRelativeTime(data?.fetchedAt ?? lastSuccessfulAt)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <PanelLoading rows={4} /> : error && !data ? <PanelError error={error} onRetry={refresh} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="py-2">時刻</th>
                  <th className="py-2">M</th>
                  <th className="py-2">震源</th>
                  <th className="py-2">深さ</th>
                </tr>
              </thead>
              <tbody>
                {earthquakes.slice(0, 12).map((quake) => (
                  <tr key={quake.id} className="border-b last:border-0">
                    <td className="py-2 text-xs text-muted-foreground">{new Date(quake.time).toLocaleString("ja-JP")}</td>
                    <td className="py-2 font-semibold">{quake.magnitude.toFixed(1)}</td>
                    <td className="py-2">{quake.place}</td>
                    <td className="py-2 text-muted-foreground">{quake.depthKm == null ? "--" : `${quake.depthKm.toFixed(1)}km`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {error && data && <div className="mt-3"><PanelError error={error} onRetry={refresh} /></div>}
      </CardContent>
    </Card>
  );
}
