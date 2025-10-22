"use client";

import React, { useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";

interface SignUpFormProps {
  onSuccess?: () => void;
  onLoginClick: () => void;
}

export default function SignUpForm({
  onSuccess,
  onLoginClick,
}: SignUpFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const { signUpWithEmail, signInWithGoogle, error, clearError } = useAuth();

  const validateForm = () => {
    if (!agreeToTerms) {
      setValidationError(
        "同意するには、利用規約とプライバシーポリシーに同意する必要があります。"
      );
      return false;
    }
    if (password !== confirmPassword) {
      setValidationError("パスワードが一致しません。");
      return false;
    }
    if (password.length < 6) {
      setValidationError("パスワードは6文字以上で入力してください。");
      return false;
    }
    setValidationError("");
    return true;
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await signUpWithEmail(email, password, displayName);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Sign up error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (!agreeToTerms) {
      setValidationError(
        "同意するには、利用規約とプライバシーポリシーに同意する必要があります。"
      );
      return;
    }
    setIsLoading(true);
    try {
      await signInWithGoogle();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Google sign up error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const displayError = validationError || error;

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-8 backdrop-blur-sm bg-opacity-95 border border-gray-100">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
          アカウントを作成
        </h2>

        {displayError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm animate-slide-up">
            <div className="flex items-center">
              <span className="mr-2">エラー：</span>
              {displayError}
            </div>
          </div>
        )}

        <form onSubmit={handleEmailSignUp} className="space-y-4">
          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              ユーザー名
            </label>
            <input
              type="text"
              id="displayName"
              value={displayName}
              onChange={e => {
                setDisplayName(e.target.value);
                clearError();
              }}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
              placeholder="ユーザー名を入力"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              メールアドレス
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={e => {
                setEmail(e.target.value);
                clearError();
              }}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
              placeholder="example@email.com"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              パスワード
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  clearError();
                  setValidationError("");
                }}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12 transition-all duration-200 bg-gray-50 hover:bg-white"
                placeholder="••••••••"
                required
                disabled={isLoading}
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 text-xl transition-colors duration-200"
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              パスワード（確認）
            </label>
            <input
              type={showPassword ? "text" : "password"}
              id="confirmPassword"
              value={confirmPassword}
              onChange={e => {
                setConfirmPassword(e.target.value);
                setValidationError("");
              }}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
              placeholder="••••••••"
              required
              disabled={isLoading}
            />
          </div>

          <div className="mt-4">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="agreeToTerms"
                checked={agreeToTerms}
                onChange={e => {
                  setAgreeToTerms(e.target.checked);
                  setValidationError("");
                }}
                className="mt-1 mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={isLoading}
              />
              <label htmlFor="agreeToTerms" className="text-sm text-gray-700">
                <a
                  href="/terms"
                  target="_blank"
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  利用規約
                </a>
                と
                <a
                  href="/privacy"
                  target="_blank"
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  プライバシーポリシー
                </a>
                に同意する
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isLoading ? "作成中..." : "アカウントを作成"}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">または</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignUp}
            disabled={isLoading}
            className="mt-4 w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-gray-700 font-medium">
              {isLoading ? "作成中..." : "Googleで続ける"}
            </span>
          </button>
        </div>

        <div className="mt-6 text-center">
          <span className="text-gray-600">
            すでにアカウントをお持ちですか？
          </span>
          <button
            onClick={onLoginClick}
            className="ml-1 text-blue-600 hover:text-blue-700 font-medium"
            disabled={isLoading}
          >
            ログイン
          </button>
        </div>
      </div>
    </div>
  );
}
