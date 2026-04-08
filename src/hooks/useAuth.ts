import { useState, useEffect } from "react";
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

/**
 * Firebase認証エラーメッセージを日本語に変換
 */
function translateAuthError(error: any): string {
  if (!error || !error.code) {
    return "認証エラーが発生しました";
  }

  const errorCode = error.code;
  
  switch (errorCode) {
    case "auth/email-already-in-use":
      return "このメールアドレスは既に使用されています";
    case "auth/invalid-email":
      return "メールアドレスの形式が正しくありません";
    case "auth/operation-not-allowed":
      return "この認証方法は許可されていません";
    case "auth/weak-password":
      return "パスワードが弱すぎます。6文字以上で設定してください";
    case "auth/user-disabled":
      return "このアカウントは無効化されています";
    case "auth/user-not-found":
      return "このメールアドレスのアカウントが見つかりません";
    case "auth/wrong-password":
      return "パスワードが正しくありません";
    case "auth/invalid-credential":
      return "メールアドレスまたはパスワードが正しくありません";
    case "auth/too-many-requests":
      return "リクエストが多すぎます。しばらくしてから再度お試しください";
    case "auth/network-request-failed":
      return "ネットワークエラーが発生しました。接続を確認してください";
    case "auth/internal-error":
      return "内部エラーが発生しました。しばらくしてから再度お試しください";
    default:
      // エラーコードが不明な場合は、メッセージがあれば使用、なければデフォルトメッセージ
      return error.message || "認証エラーが発生しました";
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Firebase設定が正しく設定されている場合のみ認証を有効化
    if (
      auth &&
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== "your_firebase_api_key_here"
    ) {
      const unsubscribe = onAuthStateChanged(auth, user => {
        setUser(user);
        setLoading(false);
      });

      return unsubscribe;
    } else {
      // Firebase設定がない場合は認証を無効化
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    if (!auth) return { success: false, error: "Firebaseが初期化されていません" };
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: result.user };
    } catch (error: any) {
      return { success: false, error: translateAuthError(error) };
    }
  };

  const register = async (email: string, password: string) => {
    if (!auth) return { success: false, error: "Firebaseが初期化されていません" };
    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      return { success: true, user: result.user };
    } catch (error: any) {
      return { success: false, error: translateAuthError(error) };
    }
  };

  const logout = async () => {
    if (!auth) return { success: false, error: "Firebaseが初期化されていません" };
    try {
      await signOut(auth);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: translateAuthError(error) };
    }
  };

  const resetPassword = async (email: string) => {
    if (!auth) return { success: false, error: "Firebaseが初期化されていません" };
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: translateAuthError(error) };
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!auth?.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken();
    } catch {
      return null;
    }
  };

  return {
    user,
    loading,
    login,
    register,
    logout,
    resetPassword,
    getIdToken,
  };
}
