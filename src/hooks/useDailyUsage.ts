"use client";

import { useState, useEffect, useCallback } from "react";
import { useSubscription } from "./useSubscription";
import {
  incrementUsageData,
  parseStoredUsage,
  todayJst,
  type DailyUsageData,
} from "@/lib/freeUsage";

/** 無料プランの1日あたりのAI機能利用上限 */
export const FREE_DAILY_LIMIT = 5;

const STORAGE_KEY = "kabu_ana_daily_usage";

function getStoredUsage(): DailyUsageData {
  const today = todayJst();
  if (typeof window === "undefined") return { date: today, count: 0 };
  try {
    return parseStoredUsage(localStorage.getItem(STORAGE_KEY), today);
  } catch {
    // localStorage が使えない環境（プライベートモード等）は 0 回として扱う
    return { date: today, count: 0 };
  }
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
  // localStorage の実値はマウント後に反映する（hydration mismatch 回避）。
  const [usageData, setUsageData] = useState<DailyUsageData>(() => ({
    date: todayJst(),
    count: 0,
  }));

  // マウント時に加え、アプリ・タブに戻ってきたときにも読み直す。
  // 開いたまま日付をまたいでも（JST 0 時）回数が戻り、別タブでの利用も反映される
  useEffect(() => {
    const refresh = () => setUsageData(getStoredUsage());
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === STORAGE_KEY) refresh();
    };
    refresh();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", handleStorage);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const usageCount = usageData.count;
  const remainingUses = Math.max(0, FREE_DAILY_LIMIT - usageCount);
  const canUseFeature = isPremium || remainingUses > 0;

  /** 分析が成功したあとに呼ぶ（失敗した分は数えない） */
  const incrementUsage = useCallback(() => {
    // プレミアムユーザーはカウントしない
    if (isPremium) return;

    // 他のタブで増えた分を取りこぼさないよう、保存値を基準に加算する
    const newData = incrementUsageData(getStoredUsage(), todayJst());
    saveUsage(newData);
    setUsageData(newData);
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
