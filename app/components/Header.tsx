"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* ロゴ */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl">📊</span>
            <span className="text-xl font-bold text-gray-900">
              株価分析AIカード
            </span>
          </Link>

          {/* ナビゲーション */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link
              href="/karte"
              className="text-gray-600 hover:text-gray-900 transition"
            >
              AIカード
            </Link>
            <Link
              href="/dashboard"
              className="text-gray-600 hover:text-gray-900 transition"
            >
              ダッシュボード
            </Link>
            <Link
              href="/news"
              className="text-gray-600 hover:text-gray-900 transition"
            >
              ニュース
            </Link>
            <Link
              href="/ranking"
              className="text-gray-600 hover:text-gray-900 transition"
            >
              ランキング
            </Link>
          </nav>

          {/* ユーザー情報 */}
          {user ? (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                    {user.displayName?.[0] || user.email?.[0] || "U"}
                  </div>
                )}
                <span className="text-sm text-gray-700 hidden sm:block">
                  {user.displayName || user.email}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-900 transition"
              >
                ログアウト
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-sm text-gray-600 hover:text-gray-900 transition"
              >
                ログイン
              </Link>
              <Link
                href="/login"
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                新規登録
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
