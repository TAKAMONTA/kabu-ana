import { NextResponse } from "next/server";

// エラータイプの定義
export enum ErrorType {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  API_ERROR = "API_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

// カスタムエラークラス
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    type: ErrorType = ErrorType.INTERNAL_ERROR,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.type = type;
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// セキュアなエラーレスポンス生成
export function createErrorResponse(
  error: unknown,
  defaultMessage: string = "処理中にエラーが発生しました"
): NextResponse {
  // 本番環境では詳細なエラー情報を隠す
  const isProduction = process.env.NODE_ENV === "production";

  if (error instanceof AppError) {
    // アプリケーションエラー
    return NextResponse.json(
      {
        error: isProduction ? "処理中にエラーが発生しました" : error.message,
        type: isProduction ? undefined : error.type,
        statusCode: error.statusCode,
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof Error) {
    // 一般的なエラー
    return NextResponse.json(
      {
        error: isProduction ? defaultMessage : error.message,
        type: isProduction ? undefined : ErrorType.INTERNAL_ERROR,
      },
      { status: 500 }
    );
  }

  // 未知のエラー
  return NextResponse.json(
    {
      error: defaultMessage,
      type: isProduction ? undefined : ErrorType.INTERNAL_ERROR,
    },
    { status: 500 }
  );
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
