"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import LoginForm from "@/app/components/auth/LoginForm";
import SignUpForm from "@/app/components/auth/SignUpForm";

export default function LoginPage() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/karte");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center mb-4">
            <div className="text-6xl mr-3 animate-pulse">📈</div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              株価分析AIカード
            </h1>
          </div>
          <p className="text-xl text-gray-700 mb-2 font-medium">
            AIの力で株価情報をより深く理解しやすく
          </p>
          <p className="text-lg text-gray-600">
            包括的な企業分析と投資判断のためのAIツール
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start max-w-7xl mx-auto">
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-8 backdrop-blur-sm bg-opacity-95 border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="mr-2">🚀</span>
                サービスの特徴
              </h2>

              <div className="space-y-4">
                <div className="flex items-start group hover:transform hover:scale-105 transition-transform duration-200">
                  <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">🤖</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="font-bold text-lg text-gray-900 mb-1">
                      AI分析
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      最新のAI技術で企業の財務指標や市場動向を包括的に分析
                    </p>
                  </div>
                </div>

                <div className="flex items-start group hover:transform hover:scale-105 transition-transform duration-200">
                  <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">📊</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="font-bold text-lg text-gray-900 mb-1">
                      チャート分析
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      財務指標やテクニカル分析を視覚的に分かりやすく表示
                    </p>
                  </div>
                </div>

                <div className="flex items-start group hover:transform hover:scale-105 transition-transform duration-200">
                  <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">💡</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="font-bold text-lg text-gray-900 mb-1">
                      投資判断支援
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      リスク評価と投資機会の分析で、より良い投資判断を支援
                    </p>
                  </div>
                </div>

                <div className="flex items-start group hover:transform hover:scale-105 transition-transform duration-200">
                  <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">🔍</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="font-bold text-lg text-gray-900 mb-1">
                      リアルタイム更新
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      最新の市場データと企業情報をリアルタイムで分析結果
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-8 backdrop-blur-sm bg-opacity-95 border border-gray-100">
              <div className="flex justify-center mb-6">
                <div className="bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setIsLoginMode(true)}
                    className={`px-6 py-2 rounded-md font-medium transition-all ${
                      isLoginMode
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    ログイン
                  </button>
                  <button
                    onClick={() => setIsLoginMode(false)}
                    className={`px-6 py-2 rounded-md font-medium transition-all ${
                      !isLoginMode
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    新規登録
                  </button>
                </div>
              </div>

              {isLoginMode ? (
                <LoginForm onSignUpClick={() => setIsLoginMode(false)} />
              ) : (
                <SignUpForm onLoginClick={() => setIsLoginMode(true)} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
