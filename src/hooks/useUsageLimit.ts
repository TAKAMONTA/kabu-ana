"use client";

import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./useAuth";
import { useSubscription } from "./useSubscription";

/**
 * 使用制限の設定
 */
const USAGE_LIMITS = {
  FREE_DAILY_LIMIT: 3, // 無料ユーザーの1日あたりの分析回数
} as const;

/**
 * 使用状況の型定義
 */
interface UsageData {
  date: string; // YYYY-MM-DD
  analysisCount: number;
  financialCount: number;
  newsCount: number;
}

interface UsageDocument {
  userId: string;
  dailyUsage: UsageData;
  totalAnalysis: number;
  totalFinancial: number;
  totalNews: number;
  updatedAt: any;
}

/**
 * 今日の日付を YYYY-MM-DD 形式で取得
 */
function getTodayString(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

/**
 * 使用回数制限を管理するカスタムフック
 */
export function useUsageLimit() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  // 今日の使用状況を取得
  useEffect(() => {
    if (!user || !db) {
      setUsage(null);
      setLoading(false);
      return;
    }

    const fetchUsage = async () => {
      if (!db) return;
      try {
        const usageRef = doc(db, "usage", user.uid);
        const snapshot = await getDoc(usageRef);
        const today = getTodayString();

        if (snapshot.exists()) {
          const data = snapshot.data() as UsageDocument;
          
          // 日付が今日と一致するかチェック
          if (data.dailyUsage?.date === today) {
            setUsage(data.dailyUsage);
          } else {
            // 新しい日なのでリセット
            const newUsage: UsageData = {
              date: today,
              analysisCount: 0,
              financialCount: 0,
              newsCount: 0,
            };
            setUsage(newUsage);
          }
        } else {
          // 初めてのユーザー
          const newUsage: UsageData = {
            date: today,
            analysisCount: 0,
            financialCount: 0,
            newsCount: 0,
          };
          setUsage(newUsage);
        }
      } catch (error) {
        console.error("使用状況の取得エラー:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, [user]);

  /**
   * 使用回数をインクリメント
   */
  const incrementUsage = useCallback(
    async (type: "analysis" | "financial" | "news") => {
      if (!user || !db) return;

      const today = getTodayString();
      const usageRef = doc(db, "usage", user.uid);

      try {
        const snapshot = await getDoc(usageRef);
        let currentUsage: UsageData = {
          date: today,
          analysisCount: 0,
          financialCount: 0,
          newsCount: 0,
        };
        let totalAnalysis = 0;
        let totalFinancial = 0;
        let totalNews = 0;

        if (snapshot.exists()) {
          const data = snapshot.data() as UsageDocument;
          if (data.dailyUsage?.date === today) {
            currentUsage = data.dailyUsage;
          }
          totalAnalysis = data.totalAnalysis || 0;
          totalFinancial = data.totalFinancial || 0;
          totalNews = data.totalNews || 0;
        }

        // カウントをインクリメント
        switch (type) {
          case "analysis":
            currentUsage.analysisCount += 1;
            totalAnalysis += 1;
            break;
          case "financial":
            currentUsage.financialCount += 1;
            totalFinancial += 1;
            break;
          case "news":
            currentUsage.newsCount += 1;
            totalNews += 1;
            break;
        }

        // Firestoreに保存
        await setDoc(usageRef, {
          userId: user.uid,
          dailyUsage: currentUsage,
          totalAnalysis,
          totalFinancial,
          totalNews,
          updatedAt: serverTimestamp(),
        });

        setUsage(currentUsage);
      } catch (error) {
        console.error("使用状況の更新エラー:", error);
        throw error;
      }
    },
    [user]
  );

  /**
   * 特定の機能が使用可能かチェック
   */
  const canUse = useCallback(
    (type: "analysis" | "financial" | "news"): boolean => {
      // プレミアムユーザーは無制限
      if (isPremium) return true;

      // 未ログインユーザーは使用不可（ログインを促す）
      if (!user) return false;

      // 使用状況が読み込まれていない場合は一旦許可
      if (!usage) return true;

      const today = getTodayString();
      
      // 日付が違う場合はリセットされているはずなので許可
      if (usage.date !== today) return true;

      // 1日の合計使用回数をチェック
      const totalToday = usage.analysisCount + usage.financialCount + usage.newsCount;
      return totalToday < USAGE_LIMITS.FREE_DAILY_LIMIT;
    },
    [isPremium, user, usage]
  );

  /**
   * 残りの使用可能回数を取得
   */
  const getRemainingUsage = useCallback((): number => {
    if (isPremium) return Infinity;
    if (!user) return 0;
    if (!usage) return USAGE_LIMITS.FREE_DAILY_LIMIT;

    const today = getTodayString();
    if (usage.date !== today) return USAGE_LIMITS.FREE_DAILY_LIMIT;

    const totalToday = usage.analysisCount + usage.financialCount + usage.newsCount;
    return Math.max(0, USAGE_LIMITS.FREE_DAILY_LIMIT - totalToday);
  }, [isPremium, user, usage]);

  return {
    usage,
    loading,
    isPremium,
    canUse,
    getRemainingUsage,
    incrementUsage,
    dailyLimit: USAGE_LIMITS.FREE_DAILY_LIMIT,
  };
}

