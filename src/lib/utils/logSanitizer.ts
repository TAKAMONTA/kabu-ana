/**
 * ログ出力用の識別子マスク・エラーメッセージのサニタイズユーティリティ
 *
 * 決済Webhookや退会APIなど、ユーザー識別子を扱う処理のログから
 * 個人情報・決済メタデータが平文で漏れることを防ぐための共通関数。
 */

const MAX_ERROR_MESSAGE_LENGTH = 200;
const TRUNCATION_MARKER = "…(truncated)";
// split/joinによる置換は短い文字列だとメッセージ本文を意図せず破壊するため、
// これ未満の長さのidはマスク対象から除外する。
const MIN_MASKABLE_ID_LENGTH = 6;

/**
 * ログ出力用にIDをマスクする（末尾4文字のみ表示し、完全な値の露出を防ぐ）
 * 文字列以外の値もString変換して扱うため、null/undefinedを渡してもTypeErrorにならない。
 */
export function maskId(id: unknown): string {
  if (id == null || id === "") return "unknown";
  const value = String(id);
  return value.length <= 4 ? "****" : `...${value.slice(-4)}`;
}

/**
 * エラーからログ出力用の安全なメッセージ文字列を生成する。
 * - throwされた値がnull/undefined/非Errorオブジェクトでも例外を投げない
 * - idsToMaskに渡した識別子は先にマスクしてから最大200文字に切り詰める
 *   （切り詰めを先に行うと識別子が境界で分断され、断片が残留する恐れがあるため）
 * - 6文字未満の短いidはメッセージ破壊を防ぐためマスク対象から除外する
 * - 切り詰めが発生した場合は末尾に省略マーカーを付与する
 */
export function sanitizeError(
  error: unknown,
  idsToMask?: Array<string | undefined | null>
): string {
  const messageValue =
    error && typeof error === "object" && "message" in error
      ? (error as Record<string, unknown>).message
      : undefined;

  let message = String(messageValue ?? error);

  if (idsToMask) {
    for (const id of idsToMask) {
      if (!id) continue;
      if (id.length < MIN_MASKABLE_ID_LENGTH) continue;
      message = message.split(id).join(maskId(id));
    }
  }

  return message.length > MAX_ERROR_MESSAGE_LENGTH
    ? message.slice(0, MAX_ERROR_MESSAGE_LENGTH) + TRUNCATION_MARKER
    : message;
}
