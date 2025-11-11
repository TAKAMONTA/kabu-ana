"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PickItem {
  name: string;
  symbol?: string;
}

interface TodayPicksSectionProps {
  jp: PickItem[] | null;
  us: PickItem[] | null;
  isPicksLoading: boolean;
  picksError: string | null;
  onSelectPick: (query: string) => void;
}

export function TodayPicksSection({
  jp,
  us,
  isPicksLoading,
  picksError,
  onSelectPick,
}: TodayPicksSectionProps) {
  const handlePickClick = useCallback(
    (item: PickItem) => {
      const q = item.symbol || item.name;
      onSelectPick(q);
    },
    [onSelectPick]
  );

  return (
    <div className="mb-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">今日の注目銘柄（ニュースベース）</CardTitle>
            <span className="text-xs text-muted-foreground">
              {isPicksLoading ? "更新中..." : picksError ? "取得に失敗" : "AI選定"}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {/* デバッグ情報 */}
          {!isPicksLoading && (!jp || jp.length === 0) && (!us || us.length === 0) && (
            <div className="text-sm text-muted-foreground mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              注目銘柄データが取得できませんでした。
              {picksError && <div className="mt-1 text-red-600">エラー: {picksError}</div>}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">日本株</h4>
              <ul className="space-y-2">
                {(jp && jp.length > 0 ? jp : []).slice(0, 3).map((item, i) => (
                  <li key={`jp-${i}`} className="flex items-center justify-between p-2 border rounded-md">
                    <span className="truncate">
                      {item.name}
                      {item.symbol && (
                        <span className="ml-2 text-xs text-muted-foreground">{item.symbol}:TYO</span>
                      )}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePickClick(item)}
                    >
                      分析
                    </Button>
                  </li>
                ))}
                {(!jp || jp.length === 0) && !isPicksLoading && (
                  <li className="p-2 text-sm text-muted-foreground">
                    データを取得できませんでした
                  </li>
                )}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">米国株</h4>
              <ul className="space-y-2">
                {(us && us.length > 0 ? us : []).slice(0, 3).map((item, i) => (
                  <li key={`us-${i}`} className="flex items-center justify-between p-2 border rounded-md">
                    <span className="truncate">
                      {item.name}
                      {item.symbol && (
                        <span className="ml-2 text-xs text-muted-foreground">{item.symbol}</span>
                      )}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePickClick(item)}
                    >
                      分析
                    </Button>
                  </li>
                ))}
                {(!us || us.length === 0) && !isPicksLoading && (
                  <li className="p-2 text-sm text-muted-foreground">
                    データを取得できませんでした
                  </li>
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

