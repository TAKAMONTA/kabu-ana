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
 * 数値を読みやすい形式にフォーマットする
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
  if (isNaN(num)) return "N/A";

  const { currency = "", decimals = 2, compact = true } = options || {};

  if (compact && Math.abs(num) >= 1e12) {
    return `${currency}${(num / 1e12).toFixed(1)}T`;
  } else if (compact && Math.abs(num) >= 1e9) {
    return `${currency}${(num / 1e9).toFixed(1)}B`;
  } else if (compact && Math.abs(num) >= 1e6) {
    return `${currency}${(num / 1e6).toFixed(1)}M`;
  } else if (compact && Math.abs(num) >= 1e3) {
    return `${currency}${(num / 1e3).toFixed(1)}K`;
  } else {
    return `${currency}${num.toLocaleString("ja-JP", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }
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
    if (abs >= 1e12) return `${currency}${trimDecimal(value / 1e12)}兆`;
    if (abs >= 1e8) return `${currency}${trimDecimal(value / 1e8)}億`;
    if (abs >= 1e4) return `${currency}${trimDecimal(value / 1e4)}万`;
    return `${currency}${value.toLocaleString("ja-JP")}`;
  }

  if (abs >= 1e12) return `${currency}${trimDecimal(value / 1e12)}T`;
  if (abs >= 1e9) return `${currency}${trimDecimal(value / 1e9)}B`;
  if (abs >= 1e6) return `${currency}${trimDecimal(value / 1e6)}M`;
  if (abs >= 1e3) return `${currency}${trimDecimal(value / 1e3)}K`;
  return `${currency}${value.toLocaleString("ja-JP")}`;
}
