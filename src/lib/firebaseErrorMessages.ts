const FIREBASE_AUTH_MESSAGES: Record<string, string> = {
  "auth/invalid-email": "メールアドレスの形式が正しくありません。",
  "auth/user-disabled": "このアカウントは無効化されています。",
  "auth/user-not-found": "メールアドレスまたはパスワードが正しくありません。",
  "auth/wrong-password": "メールアドレスまたはパスワードが正しくありません。",
  "auth/invalid-credential": "メールアドレスまたはパスワードが正しくありません。",
  "auth/email-already-in-use": "このメールアドレスは既に登録されています。",
  "auth/weak-password": "パスワードは6文字以上で設定してください。",
  "auth/operation-not-allowed": "この認証方法は現在利用できません。",
  "auth/too-many-requests":
    "リクエストが多すぎます。しばらく時間をおいてからお試しください。",
  "auth/network-request-failed":
    "ネットワークエラーが発生しました。接続を確認してください。",
  "auth/missing-password": "パスワードを入力してください。",
  "auth/invalid-login-credentials":
    "メールアドレスまたはパスワードが正しくありません。",
};

export function getFirebaseAuthErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    if (FIREBASE_AUTH_MESSAGES[code]) {
      return FIREBASE_AUTH_MESSAGES[code];
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "認証処理中にエラーが発生しました。";
}
