"use client";

import { ReactNode } from "react";

interface StatsCardProps {
  label: string;
  value: ReactNode;
  description?: string;
  icon?: ReactNode;
  highlight?: boolean;
  trend?: "up" | "down" | "neutral";
}

export function StatsCard({
  label,
  value,
  description,
  icon,
  highlight,
  trend,
}: StatsCardProps) {
  return (
    <div
      className={`p-4 border rounded-lg transition-all ${
        highlight
          ? "bg-primary/8 border-primary/40 shadow-sm"
          : "bg-muted/30 border-border hover:bg-muted/50 hover:border-primary/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {label}
          </p>
          <p className={`text-lg font-bold mt-2 break-words ${
            trend === "up"
              ? "text-green-600 dark:text-green-400"
              : trend === "down"
              ? "text-red-600 dark:text-red-400"
              : "text-foreground"
          }`}>
            {value}
          </p>
          {description && (
            <p className="text-xs text-muted-foreground mt-2">{description}</p>
          )}
        </div>
        {icon && (
          <div className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</div>
        )}
      </div>
    </div>
  );
}
