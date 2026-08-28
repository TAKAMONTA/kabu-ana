/** 無料プランで登録できる銘柄数の上限 */
export const FREE_WATCHLIST_LIMIT = 3;

/**
 * プランごとの上限。
 * プレミアムは Number.POSITIVE_INFINITY という有限でない値を返す。
 * JSON に載せる・画面に出す場合は、呼び出し側で Number.isFinite() を確認すること
 * （JSON.stringify すると null になり、課金ユーザーだけ追加できなくなる事故につながる）。
 */
export function watchlistLimit(isPremium: boolean): number {
  return isPremium ? Number.POSITIVE_INFINITY : FREE_WATCHLIST_LIMIT;
}

/** 現在の登録数から、あと1件追加できるかを判定する */
export function canAddMore(currentCount: number, isPremium: boolean): boolean {
  return currentCount < watchlistLimit(isPremium);
}
