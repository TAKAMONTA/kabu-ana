"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell } from "lucide-react";
import type { AlertItem, AlertSettings } from "@/hooks/useAlerts";

interface AlertCenterSectionProps {
  userLoggedIn: boolean;
  settings: AlertSettings;
  alerts: AlertItem[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  onToggleEnabled: () => void | Promise<void>;
  onToggleNewsImpact: () => void | Promise<void>;
  onToggleFinancial: () => void | Promise<void>;
  onChangeNewsThreshold: (value: number) => void | Promise<void>;
  onChangeFinancialThreshold: (value: number) => void | Promise<void>;
  onChangeCooldownMinutes: (value: number) => void | Promise<void>;
  onMarkAsRead: (alertId: string) => void | Promise<void>;
  onMarkAllAsRead: () => void | Promise<void>;
}

function formatDateTime(date?: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function severityLabel(severity: AlertItem["severity"]): string {
  if (severity === "high") return "High";
  if (severity === "low") return "Low";
  return "Medium";
}

function severityClassName(severity: AlertItem["severity"]): string {
  if (severity === "high") return "bg-red-100 text-red-700 border-red-200";
  if (severity === "low") return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
}

export function AlertCenterSection({
  userLoggedIn,
  settings,
  alerts,
  unreadCount,
  loading,
  error,
  onToggleEnabled,
  onToggleNewsImpact,
  onToggleFinancial,
  onChangeNewsThreshold,
  onChangeFinancialThreshold,
  onChangeCooldownMinutes,
  onMarkAsRead,
  onMarkAllAsRead,
}: AlertCenterSectionProps) {
  if (!userLoggedIn) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          通知センター
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={settings.enabled ? "default" : "outline"}
            size="sm"
            onClick={onToggleEnabled}
          >
            全体通知: {settings.enabled ? "ON" : "OFF"}
          </Button>
          <Button
            variant={settings.newsImpactEnabled ? "default" : "outline"}
            size="sm"
            onClick={onToggleNewsImpact}
            disabled={!settings.enabled}
          >
            ニュース影響: {settings.newsImpactEnabled ? "ON" : "OFF"}
          </Button>
          <Button
            variant={settings.financialScoreEnabled ? "default" : "outline"}
            size="sm"
            onClick={onToggleFinancial}
            disabled={!settings.enabled}
          >
            財務スコア急変: {settings.financialScoreEnabled ? "ON" : "OFF"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              ニュース通知しきい値（|impactScore|）
            </p>
            <Input
              type="number"
              min={0}
              max={100}
              value={settings.newsImpactThreshold}
              onChange={(e) => onChangeNewsThreshold(Number(e.target.value))}
              disabled={!settings.enabled || !settings.newsImpactEnabled}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              財務スコア急変しきい値（差分）
            </p>
            <Input
              type="number"
              min={1}
              max={4}
              value={settings.financialScoreChangeThreshold}
              onChange={(e) => onChangeFinancialThreshold(Number(e.target.value))}
              disabled={!settings.enabled || !settings.financialScoreEnabled}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              連投抑制クールダウン（分）
            </p>
            <Input
              type="number"
              min={1}
              max={240}
              value={settings.cooldownMinutes}
              onChange={(e) => onChangeCooldownMinutes(Number(e.target.value))}
              disabled={!settings.enabled}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">最近の通知（未読: {unreadCount}）</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onMarkAllAsRead}
              disabled={unreadCount === 0}
            >
              すべて既読
            </Button>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">通知履歴を読み込み中...</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              まだ通知はありません。ウォッチ銘柄でAI分析を実行すると通知が記録されます。
            </p>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 8).map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-md border p-2 ${
                    alert.read ? "" : "border-blue-300 bg-blue-50/40"
                  }`}
                >
                  <div className="mb-1">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityClassName(
                        alert.severity
                      )}`}
                    >
                      {severityLabel(alert.severity)}
                    </span>
                  </div>
                  <p className="text-sm">{alert.message}</p>
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <p className="text-xs text-muted-foreground">
                      {alert.companyName} ({alert.symbol}) {formatDateTime(alert.createdAt)}
                    </p>
                    {!alert.read && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onMarkAsRead(alert.id)}
                      >
                        既読
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
