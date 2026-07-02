/**
 * 日本時間(JST)基準の日付文字列を返す (YYYY-MM-DD)
 */
export function getJstDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
