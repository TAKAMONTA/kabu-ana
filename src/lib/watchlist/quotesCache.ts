/** ウォッチリスト一覧で表示する1銘柄分の株価 */
export interface WatchlistQuote {
  close: number;
  changePercent: number;
  /** 値の基準日（YYYY-MM-DD） */
  asOf?: string;
}

/** キャッシュの有効期間。J-Quants は1営業日1回しか更新されないので長めでよい */
export const QUOTES_TTL_MS = 15 * 60 * 1000;

interface CacheEntry {
  quote: WatchlistQuote;
  storedAt: number;
  /** 保存時点の JST の日付（YYYY-MM-DD） */
  storedJstDate: string;
}

/** UTC ミリ秒から JST の日付文字列を作る */
function jstDate(epochMs: number): string {
  return new Date(epochMs + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 銘柄コード単位の株価キャッシュ。
 * 現在時刻を引数で受け取るため、テストで時間を操作できる。
 */
export class QuotesCache {
  private entries = new Map<string, CacheEntry>();

  get(code: string, now: number): WatchlistQuote | null {
    const entry = this.entries.get(code);
    if (!entry) return null;
    if (now - entry.storedAt > QUOTES_TTL_MS) return null;
    // 日付をまたいだら前営業日の値を返さない
    if (jstDate(now) !== entry.storedJstDate) return null;
    return entry.quote;
  }

  set(code: string, quote: WatchlistQuote, now: number): void {
    this.entries.set(code, {
      quote,
      storedAt: now,
      storedJstDate: jstDate(now),
    });
  }
}
