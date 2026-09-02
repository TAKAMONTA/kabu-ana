/**
 * JST の日付ID（YYYY-MM-DD）。ダイジェストの「1日1回」の境界。
 * 現在時刻は引数で受け、テストで時間を操作できるようにする。
 */
export function jstDateId(epochMs: number): string {
  return new Date(epochMs + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
