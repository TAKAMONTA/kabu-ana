/**
 * 全角文字を半角文字に変換する
 */
export function toHalfWidth(str: string): string {
  return (
    str
      .replace(/[Ａ-Ｚａ-ｚ０-９：]/g, char => {
        return String.fromCharCode(char.charCodeAt(0) - 0xfee0);
      })
      // 全角スペースも半角スペースに変換
      .replace(/　/g, " ")
  );
}

/**
 * 検索クエリを正規化する（全角→半角、スペース削除）
 */
export function normalizeQuery(query: string): string {
  return toHalfWidth(query)
    .trim()
    .replace(/\s+/g, "") // すべてのスペースを削除
    .replace(/[^a-zA-Z0-9:]/g, match => {
      // 日本語文字はそのまま保持
      if (
        /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(
          match
        )
      ) {
        return match;
      }
      return "";
    });
}

/**
 * 数値を読みやすい形式にフォーマットする。
 * compact のとき、円（¥）は 兆・億・万（例: ¥45.1兆、¥3,123億、¥1.5万）、
 * それ以外の通貨は T/B/M/K で短くする。符号は通貨記号の前に付ける（-¥1.2億）。
 * 1株あたりの値（EPS 等）は compact: false で使うこと。
 */
export function formatNumber(
  value: number | string | null | undefined,
  options?: {
    currency?: string;
    decimals?: number;
    compact?: boolean;
  }
): string {
  if (value === null || value === undefined || value === "") return "N/A";

  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return "N/A";

  const { currency = "", decimals = 2, compact = true } = options || {};
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);

  if (compact && currency === "¥") {
    return `${sign}${formatJapaneseUnits(abs, "¥")}`;
  }

  if (compact && abs >= 1e12) {
    return `${sign}${currency}${(abs / 1e12).toFixed(1)}T`;
  } else if (compact && abs >= 1e9) {
    return `${sign}${currency}${(abs / 1e9).toFixed(1)}B`;
  } else if (compact && abs >= 1e6) {
    return `${sign}${currency}${(abs / 1e6).toFixed(1)}M`;
  } else if (compact && abs >= 1e3) {
    return `${sign}${currency}${(abs / 1e3).toFixed(1)}K`;
  } else {
    const formatted = abs.toLocaleString("ja-JP", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    // 丸めた結果が 0 のときに「-¥0.00」と出さない
    const shownSign = /[1-9]/.test(formatted) ? sign : "";
    return `${shownSign}${currency}${formatted}`;
  }
}

/** 値の大きさに応じて小数の桁を減らす（1.39 / 45.1 / 3,123） */
function fractionDigitsFor(scaled: number): number {
  const abs = Math.abs(scaled);
  if (abs >= 100) return 0;
  if (abs >= 10) return 1;
  return 2;
}

const JAPANESE_UNITS = [
  { unit: "兆", size: 1e12 },
  { unit: "億", size: 1e8 },
  { unit: "万", size: 1e4 },
] as const;

/**
 * 0 以上の数値を 兆・億・万 で短く表す（prefix は通貨記号など）。
 * 1万未満は桁区切りの整数で出す。
 */
function formatJapaneseUnits(abs: number, prefix: string, suffix = ""): string {
  for (let i = 0; i < JAPANESE_UNITS.length; i++) {
    const { unit, size } = JAPANESE_UNITS[i];
    if (abs < size) continue;
    const scaled = abs / size;
    const digits = fractionDigitsFor(scaled);
    const rounded = Number(scaled.toFixed(digits));
    // 9,999.6万 のように丸めで 1万単位に届いたら、一つ上の単位で表す
    if (rounded >= 10000 && i > 0) {
      const upper = JAPANESE_UNITS[i - 1];
      const upperScaled = abs / upper.size;
      return `${prefix}${upperScaled.toLocaleString("ja-JP", {
        maximumFractionDigits: fractionDigitsFor(upperScaled),
      })}${upper.unit}${suffix}`;
    }
    return `${prefix}${rounded.toLocaleString("ja-JP", {
      maximumFractionDigits: digits,
    })}${unit}${suffix}`;
  }
  return `${prefix}${Math.round(abs).toLocaleString("ja-JP")}${suffix}`;
}

/**
 * 1株あたりの金額（EPS など）。桁を丸めて「¥1.2K」のようにせず、そのまま出す。
 */
export function formatPerShare(
  value: number | string | null | undefined,
  currency: string
): string {
  return formatNumber(value, { currency, compact: false, decimals: 2 });
}

/**
 * 出来高（株数）を「1,235万株」「1.2億株」の形で表す。値が無い・0 のときは null。
 */
export function formatVolume(
  value: number | string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num) || num <= 0) return null;
  return formatJapaneseUnits(num, "", "株");
}

/**
 * 前日比を「+¥12 (+0.45%)」「-$1.23 (-0.45%)」の形で表す。
 * 円は小数1桁まで（呼値が 0.1円 単位の銘柄があるため）、ドルは小数2桁。
 * 丸めて 0 になる場合は符号を付けない。
 */
export function formatPriceChange(
  change: number,
  changePercent: number,
  currency: string
): string {
  const isYen = currency === "¥";
  const amount = Math.abs(change).toLocaleString("ja-JP", {
    minimumFractionDigits: isYen ? 0 : 2,
    maximumFractionDigits: isYen ? 1 : 2,
  });
  const amountSign = /[1-9]/.test(amount) ? (change > 0 ? "+" : "-") : "";

  const percent = Math.abs(changePercent).toFixed(2);
  const percentSign = /[1-9]/.test(percent)
    ? changePercent > 0
      ? "+"
      : "-"
    : "";

  return `${amountSign}${currency}${amount} (${percentSign}${percent}%)`;
}

/**
 * パーセンテージをフォーマットする
 */
export function formatPercentage(
  value: number | string | null | undefined
): string {
  if (value === null || value === undefined || value === "") return "N/A";

  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "N/A";

  return `${num.toFixed(2)}%`;
}

/**
 * 時価総額をフォーマットする
 */
export function formatMarketCap(
  value: number | string | null | undefined,
  options?: { currency?: string }
): string {
  if (value === null || value === undefined || value === "") return "N/A";

  const { currency = "¥" } = options || {};

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "N/A";
    return formatMarketCapNumber(value, currency);
  }

  const normalized = toHalfWidth(String(value)).trim();
  if (!normalized || /^N\/A$/i.test(normalized)) return "N/A";

  const detectedCurrency = normalized.match(/^[¥$]/)?.[0] || currency;
  const withoutCurrency = normalized
    .replace(/^[¥$]/, "")
    .replace(/円/g, "")
    .trim();

  // 日本語単位（兆・億・万）はそのまま桁を保って表示する
  const jpMatch = withoutCurrency.match(/^([+-]?[\d,.]+)\s*(兆|億|万)$/);
  if (jpMatch) {
    const amount = parseFloat(jpMatch[1].replace(/,/g, ""));
    if (!Number.isFinite(amount)) return "N/A";
    return `${detectedCurrency}${trimDecimal(amount)}${jpMatch[2]}`;
  }

  // 英語単位（T/B/M/K）
  const enMatch = withoutCurrency.match(/^([+-]?[\d,.]+)\s*([TtBbMmKk])$/);
  if (enMatch) {
    const amount = parseFloat(enMatch[1].replace(/,/g, ""));
    if (!Number.isFinite(amount)) return "N/A";
    return `${detectedCurrency}${trimDecimal(amount)}${enMatch[2].toUpperCase()}`;
  }

  // 単位なしの素の数値
  if (/^[+-]?[\d,.]+$/.test(withoutCurrency)) {
    const num = parseFloat(withoutCurrency.replace(/,/g, ""));
    if (!Number.isFinite(num)) return "N/A";
    return formatMarketCapNumber(num, detectedCurrency);
  }

  // 解釈できない値は嘘の金額を出さない
  return "N/A";
}

function trimDecimal(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function formatMarketCapNumber(value: number, currency: string): string {
  const abs = Math.abs(value);
  if (currency === "¥") {
    return `${value < 0 ? "-" : ""}${formatJapaneseUnits(abs, currency)}`;
  }

  if (abs >= 1e12) return `${currency}${trimDecimal(value / 1e12)}T`;
  if (abs >= 1e9) return `${currency}${trimDecimal(value / 1e9)}B`;
  if (abs >= 1e6) return `${currency}${trimDecimal(value / 1e6)}M`;
  if (abs >= 1e3) return `${currency}${trimDecimal(value / 1e3)}K`;
  return `${currency}${value.toLocaleString("ja-JP")}`;
}
