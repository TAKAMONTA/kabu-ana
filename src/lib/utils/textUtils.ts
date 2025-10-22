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
