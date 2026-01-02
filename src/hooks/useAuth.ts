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
    if (!auth) return { success: false, error: "Firebase not initialized" };
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: result.user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const register = async (email: string, password: string) => {
    if (!auth) return { success: false, error: "Firebase not initialized" };
    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      return { success: true, user: result.user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    if (!auth) return { success: false, error: "Firebase not initialized" };
    try {
      await signOut(auth);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const resetPassword = async (email: string) => {
    if (!auth) return { success: false, error: "Firebase not initialized" };
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  return {
    user,
    loading,
    login,
    register,
    logout,
    resetPassword,
  };
}
