/**
 * 「失敗しても許容できる」非同期処理をタイムアウト付きで実行するユーティリティ。
 * 外部APIが遅延・ハングしても呼び出し元のルート全体を巻き込まないよう、
 * 指定時間内に解決しなければ null を返す（例外は投げない）。
 */
export function optionalWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T | null> {
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      console.warn(`Optional step timed out: ${label}`);
      resolve(null);
    }, timeoutMs);

    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(error => {
        clearTimeout(timer);
        console.warn(
          `Optional step failed: ${label}`,
          error instanceof Error ? error.message : error
        );
        resolve(null);
      });
  });
}
