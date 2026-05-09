"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useGeopolRisk } from "@/hooks/signals/useGeopolRisk";

export function AnomalyTicker() {
  const { data } = useGeopolRisk();
  const anomalies = data?.anomalies ?? [];
  if (anomalies.length === 0) {
    return (
      <Card className="rounded-lg border-green-200 bg-green-50">
        <CardContent className="py-3 text-sm text-green-800">緊急アラートはありません</CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-lg border-red-200 bg-red-50">
      <CardContent className="flex items-center gap-3 py-3 text-sm text-red-800">
        <AlertTriangle className="size-4 shrink-0" />
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="truncate">
            {anomalies.map((item) => `${item.label} ${item.score.toFixed(1)} (${item.reason})`).join(" / ")}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
