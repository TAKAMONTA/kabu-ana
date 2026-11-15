/**
 * 株価チャートの軸・ツールチップ・統計の表記。
 *
 * 日付は "YYYY-MM-DD"（日足）と "YYYY-MM-DD HH:mm:ss"（Twelve Data の分足）が来る。
 * iOS の WebKit は空白区切りの日時を new Date() で解釈できず Invalid Date になるため、
 * Date を経由せず文字列から年月日・時分を取り出して整形する。
 * 時刻は取引所の現地時刻のまま表示する（タイムゾーン変換はしない）。
 */

export interface ChartDateParts {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
}

const DATE_PATTERN =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?/;

export function parseChartDate(value: unknown): ChartDateParts | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(DATE_PATTERN);
  if (!m) return null;
  const parts: ChartDateParts = {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
  };
  if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31) {
    return null;
  }
  if (m[4] !== undefined && m[5] !== undefined) {
    parts.hour = Number(m[4]);
    parts.minute = Number(m[5]);
  }
  return parts;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatTime(parts: ChartDateParts): string {
  return `${pad2(parts.hour ?? 0)}:${pad2(parts.minute ?? 0)}`;
}

/** 長期（5年・全期間）は年/月、短期は月/日、1日の分足は時:分 */
export function formatChartTick(value: unknown, period: string): string {
  const parts = parseChartDate(value);
  if (!parts) return typeof value === "string" ? value : "";
  if (period === "5Y" || period === "MAX") {
    return `${parts.year}/${parts.month}`;
  }
  if (period === "1D" && parts.hour !== undefined) {
    return formatTime(parts);
  }
  return `${parts.month}/${parts.day}`;
}

/** ツールチップは「2026年11月13日」（分足は「2026年11月13日 14:30」） */
export function formatChartTooltipLabel(value: unknown): string {
  const parts = parseChartDate(value);
  if (!parts) return typeof value === "string" ? value : "";
  const date = `${parts.year}年${parts.month}月${parts.day}日`;
  return parts.hour !== undefined ? `${date} ${formatTime(parts)}` : date;
}

/** 価格。円は小数を出さず桁区切り、ドルは小数2桁 */
export function formatChartPrice(value: number, currency: string): string {
  if (!Number.isFinite(value)) return "—";
  if (currency === "¥") {
    return `¥${Math.round(value).toLocaleString("ja-JP")}`;
  }
  return `${currency}${value.toLocaleString("ja-JP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** 縦軸の目盛り。円は整数、ドルは必要な分だけ小数 */
export function formatChartAxisPrice(value: number, currency: string): string {
  if (!Number.isFinite(value)) return "";
  if (currency === "¥") {
    return `¥${Math.round(value).toLocaleString("ja-JP")}`;
  }
  return `${currency}${value.toLocaleString("ja-JP", {
    maximumFractionDigits: 2,
  })}`;
}
