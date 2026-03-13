"use client";

import { useState, useEffect, useCallback } from "react";
import { useSubscription } from "./useSubscription";

/** 無料プランの1日あたりのAI機能利用上限 */
export const FREE_DAILY_LIMIT = 5;

const STORAGE_KEY = "kabu_ana_daily_usage";

interface DailyUsageData {
  date: string; // YYYY-MM-DD
  count: number;
}

function getTodayString(): string {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD (ローカルタイムゾーン非依存)
}

function getStoredUsage(): DailyUsageData {
  if (typeof window === "undefined") {
    return { date: getTodayString(), count: 0 };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data: DailyUsageData = JSON.parse(stored);
      // 日付が今日と異なる場合はリセット
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
  const [usageData, setUsageData] = useState<DailyUsageData>(getStoredUsage);

  // コンポーネントマウント時 & 日付変更時にリフレッシュ
  useEffect(() => {
    const current = getStoredUsage();
    setUsageData(current);
  }, []);

  const usageCount = usageData.count;
  const remainingUses = Math.max(0, FREE_DAILY_LIMIT - usageCount);
  const canUseFeature = isPremium || remainingUses > 0;

  const incrementUsage = useCallback(() => {
    // プレミアムユーザーはカウントしない
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
    /** 利用回数を+1 する */
    incrementUsage,
    /** 1日の上限回数 */
    dailyLimit: FREE_DAILY_LIMIT,
  };
}
