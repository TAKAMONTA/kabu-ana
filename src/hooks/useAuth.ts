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
import { getApiUrl } from "@/lib/utils/apiClient";
import { CapacitorHttp } from "@capacitor/core";
import {
  AUTH_UNAVAILABLE_MESSAGE,
  toAuthErrorMessage,
} from "@/lib/authErrorMessage";
import { toFriendlyErrorMessage } from "@/lib/friendlyError";

const DELETE_ACCOUNT_FALLBACK =
  "アカウントを削除できませんでした。時間をおいてもう一度お試しください。";

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

  // Firebase の英語メッセージ（"Firebase: Error (auth/...)"）は画面に出さず、
  // error.code から日本語の案内に置き換えて返す
  const login = async (email: string, password: string) => {
    if (!auth) return { success: false, error: AUTH_UNAVAILABLE_MESSAGE };
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: result.user };
    } catch (error: unknown) {
      return { success: false, error: toAuthErrorMessage(error, "login") };
    }
  };

  const register = async (email: string, password: string) => {
    if (!auth) return { success: false, error: AUTH_UNAVAILABLE_MESSAGE };
    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      return { success: true, user: result.user };
    } catch (error: unknown) {
      return { success: false, error: toAuthErrorMessage(error, "register") };
    }
  };

  const logout = async () => {
    if (!auth) return { success: false, error: AUTH_UNAVAILABLE_MESSAGE };
    try {
      await signOut(auth);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: toAuthErrorMessage(error, "logout") };
    }
  };

  const resetPassword = async (email: string) => {
    if (!auth) return { success: false, error: AUTH_UNAVAILABLE_MESSAGE };
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error: unknown) {
      return {
        success: false,
        error: toAuthErrorMessage(error, "resetPassword"),
      };
    }
  };

  const deleteAccount = async () => {
    if (!auth || !auth.currentUser) {
      return {
        success: false,
        error:
          "ログイン状態を確認できませんでした。もう一度ログインしてからお試しください。",
      };
    }

    try {
      const idToken = await auth.currentUser.getIdToken();

      const apiUrl = getApiUrl("/api/user/delete");
      const response = await CapacitorHttp.post({
        url: apiUrl,
        headers: {
          "Content-Type": "application/json",
        },
        data: { idToken },
      });

      if (response.status !== 200) {
        const errorMsg = response.data?.error || "アカウントの削除に失敗しました";
        throw new Error(errorMsg);
      }

      await signOut(auth);
      setUser(null);
      return { success: true };
    } catch (error: unknown) {
      console.error("Delete account error:", error);
      return {
        success: false,
        error: toFriendlyErrorMessage(
          error instanceof Error ? error.message : null,
          DELETE_ACCOUNT_FALLBACK
        ),
      };
    }
  };

  return {
    user,
    loading,
    login,
    register,
    logout,
    resetPassword,
    deleteAccount,
  };
}
