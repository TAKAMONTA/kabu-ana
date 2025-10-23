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
export function formatNumber(value: number | string | null | undefined, options?: {
  currency?: string;
  decimals?: number;
  compact?: boolean;
}): string {
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
    return `${currency}${num.toLocaleString('ja-JP', { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    })}`;
  }
}

/**
 * パーセンテージをフォーマットする
 */
export function formatPercentage(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "N/A";
  
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "N/A";
  
  return `${num.toFixed(2)}%`;
}

/**
 * 時価総額をフォーマットする
 */
export function formatMarketCap(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "N/A";
  
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "N/A";
  
  if (Math.abs(num) >= 1e12) {
    return `¥${(num / 1e12).toFixed(1)}T`;
  } else if (Math.abs(num) >= 1e9) {
    return `¥${(num / 1e9).toFixed(1)}B`;
  } else if (Math.abs(num) >= 1e6) {
    return `¥${(num / 1e6).toFixed(1)}M`;
  } else {
    return `¥${num.toLocaleString('ja-JP')}`;
  }
}