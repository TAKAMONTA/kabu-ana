"use client";

import { useState, useEffect, useCallback } from "react";
import { useSubscription } from "./useSubscription";
import { getJstDateString } from "@/lib/utils/jstDate";

/** 無料プランの1日あたりのAI機能利用上限 */
export const FREE_DAILY_LIMIT = 5;

const STORAGE_KEY = "kabu_ana_daily_usage";

interface DailyUsageData {
  date: string; // YYYY-MM-DD (JST)
  count: number;
}

function getTodayString(): string {
  return getJstDateString();
}

function getStoredUsage(): DailyUsageData {
  if (typeof window === "undefined") {
    return { date: getTodayString(), count: 0 };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data: DailyUsageData = JSON.parse(stored);
      if (data.date === getTodayString()) {
        return data;
      }
    }
  } catch {
    // パースエラーの場合はリセット
  }

  return { date: getTodayString(), count: 0 };
}

function saveUsage(data: DailyUsageData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage がフルの場合は無視
  }
}

/**
 * 無料プランの日次利用回数を管理するカスタムフック
 * プレミアムユーザーは常に無制限
 */
export function useDailyUsage() {
  const { isPremium } = useSubscription();
  // SSRとクライアント初回レンダリングを一致させるため、初期値は常に固定。
  const [usageData, setUsageData] = useState<DailyUsageData>({
    date: getTodayString(),
    count: 0,
  });

  useEffect(() => {
    const current = getStoredUsage();
    setUsageData(current);
  }, []);

  const usageCount = usageData.count;
  const remainingUses = Math.max(0, FREE_DAILY_LIMIT - usageCount);
  const canUseFeature = isPremium || remainingUses > 0;

  /**
   * API レスポンスの X-Daily-Remaining ヘッダーからクライアント側カウントを同期する
   */
  const syncFromServer = useCallback(
    (remaining: number) => {
      if (isPremium) return;
      const today = getTodayString();
      const count = Math.max(0, FREE_DAILY_LIMIT - remaining);
      const newData: DailyUsageData = { date: today, count };
      saveUsage(newData);
      setUsageData(newData);
    },
    [isPremium]
  );

  const incrementUsage = useCallback(() => {
    if (isPremium) return;

    setUsageData((prev) => {
      const today = getTodayString();
      const newData: DailyUsageData =
        prev.date === today
          ? { date: today, count: prev.count + 1 }
          : { date: today, count: 1 };

      saveUsage(newData);
      return newData;
    });
  }, [isPremium]);

  return {
    /** 本日の利用回数 */
    usageCount,
    /** 残り利用回数 */
    remainingUses,
    /** 機能を利用可能かどうか */
    canUseFeature,
    /** プレミアムユーザーかどうか */
    isPremium,
    /** 利用回数を+1する（楽観的更新。API失敗後は syncFromServer で上書き）*/
    incrementUsage,
    /** API の X-Daily-Remaining ヘッダー値でカウントを上書き同期 */
    syncFromServer,
    /** 1日の上限回数 */
    dailyLimit: FREE_DAILY_LIMIT,
  };
}
