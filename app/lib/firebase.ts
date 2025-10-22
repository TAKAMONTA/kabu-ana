// Firebase configuration
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Firebase config
const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyDdcyDTq0kXkIrh3qbIrimjuIlx-s6KCA0",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "ai-analysis-14efa.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ai-analysis-14efa",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "ai-analysis-14efa.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "83600755913",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:83600755913:web:d405bce243716214489118",
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-V45FE07TBZ",
};

// Firebase設定の検証
const validateFirebaseConfig = () => {
  const requiredKeys = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ];

  const missingKeys = requiredKeys.filter(key => !process.env[key]);

  if (missingKeys.length > 0) {
    console.error("Missing Firebase environment variables:", missingKeys);
    throw new Error(
      `Firebase設定が不完全です。以下の環境変数が設定されていません: ${missingKeys.join(", ")}`
    );
  }

  return true;
};

// 開発環境でのみ設定を検証
if (process.env.NODE_ENV === "development") {
  validateFirebaseConfig();
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize Analytics (only in browser environment)
export const analytics =
  typeof window !== "undefined" ? getAnalytics(app) : null;

// Authentication functions
export const signUp = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    return { success: true, user: userCredential.user };
  } catch (error: unknown) {
    let errorMessage = "Registration failed";
    if (error && typeof error === "object" && "code" in error) {
      const firebaseError = error as { code: string };
      if (firebaseError.code === "auth/email-already-in-use") {
        errorMessage = "This email is already registered";
      } else if (firebaseError.code === "auth/weak-password") {
        errorMessage = "Password should be at least 6 characters";
      } else if (firebaseError.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      }
    }
    return { success: false, error: errorMessage };
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    return { success: true, user: userCredential.user };
  } catch (error: unknown) {
    let errorMessage = "Login failed";
    if (error && typeof error === "object" && "code" in error) {
      const firebaseError = error as { code: string };
      if (firebaseError.code === "auth/user-not-found") {
        errorMessage = "User not found";
      } else if (firebaseError.code === "auth/wrong-password") {
        errorMessage = "Incorrect password";
      } else if (firebaseError.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      }
    }
    return { success: false, error: errorMessage };
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Logout failed";
    return { success: false, error: errorMessage };
  }
};

// デバッグ用: Firebase接続確認
export const checkFirebaseConnection = async () => {
  try {
    const user = auth.currentUser;
    console.log("Firebase Auth initialized:", !!auth);
    console.log("Current user:", user ? user.email : "Not logged in");
    console.log("Firebase Analytics initialized:", !!analytics);
    console.log("Firebase config loaded:", {
      apiKey: firebaseConfig.apiKey ? "Set" : "Missing",
      authDomain: firebaseConfig.authDomain ? "Set" : "Missing",
      projectId: firebaseConfig.projectId ? "Set" : "Missing",
    });
    return { success: true, message: "Firebase connection is working" };
  } catch (error) {
    console.error("Firebase connection error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// Analytics用のユーティリティ関数
export const logEvent = (
  eventName: string,
  parameters?: Record<string, any>
) => {
  if (analytics && typeof window !== "undefined") {
    import("firebase/analytics")
      .then(({ logEvent }) => {
        logEvent(analytics, eventName, parameters);
      })
      .catch(error => {
        console.error("Analytics logEvent error:", error);
      });
  }
};

// Export types and functions
export type { User };
export { onAuthStateChanged };
