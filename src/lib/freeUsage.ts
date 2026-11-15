/**
 * 無料プランの「1日◯回まで」を端末側で数えるための純粋関数。
 * 日付の境界は日本時間（JST）の 0 時。UTC の日付（toISOString）を使うと
 * 日本では朝 9 時にリセットされてしまう。
 */
import { jstDateId } from "@/lib/digest/dateId";

export interface DailyUsageData {
  /** JST の日付（YYYY-MM-DD） */
  date: string;
  count: number;
}

export function todayJst(now: number = Date.now()): string {
  return jstDateId(now);
}

/**
 * localStorage に保存した文字列を読み、今日の利用回数として解釈する。
 * 日付が今日でない・壊れている場合は 0 回から数え直す。
 */
export function parseStoredUsage(
  raw: string | null,
  today: string
): DailyUsageData {
  if (raw) {
    try {
      const data = JSON.parse(raw) as Partial<DailyUsageData> | null;
      if (
        data &&
        data.date === today &&
        typeof data.count === "number" &&
        Number.isFinite(data.count) &&
        data.count >= 0
      ) {
        return { date: today, count: Math.floor(data.count) };
      }
    } catch {
      // 壊れた値は捨てて数え直す
    }
  }
  return { date: today, count: 0 };
}

/** 1回分を加算する（日付が変わっていたら今日の1回目として数える） */
export function incrementUsageData(
  prev: DailyUsageData,
  today: string
): DailyUsageData {
  return prev.date === today
    ? { date: today, count: prev.count + 1 }
    : { date: today, count: 1 };
}
