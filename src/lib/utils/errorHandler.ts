import { NextResponse } from "next/server";

/**
 * セキュアなエラーレスポンス生成。
 * クライアントには常に固定文言だけを返す（以前は NODE_ENV が production 以外のとき
 * error.message をそのまま返していた）。詳細は logError でサーバーログに残すこと。
 */
export function createErrorResponse(
  _error: unknown,
  defaultMessage: string = "処理中にエラーが発生しました"
): NextResponse {
  return NextResponse.json({ error: defaultMessage }, { status: 500 });
}

// ログ用のエラー情報（サーバーサイドのみ）
export function logError(error: unknown, context?: string): void {
  if (process.env.NODE_ENV === "production") {
    // 本番環境では構造化ログ
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        context,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error,
      })
    );
  } else {
    // 開発環境では詳細ログ
    console.error(`[${context || "Unknown"}]`, error);
  }
}
