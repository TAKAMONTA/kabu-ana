"use client";

import { useAuth } from "./contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Header from "./components/Header";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 認証後にユーザーがログインしていない場合はランディングページにリダイレクト
    if (!loading && !user) {
      router.push("/landing");
    }
  }, [user, loading, router]);

  const features = [
    {
      title: "株価AIカード",
      description: "AIを活用した株価分析のためのツール",
      icon: "📊",
      href: "/karte",
    },
    {
      title: "市場ニュース",
      description: "AI分析で市場動向を把握",
      icon: "📰",
      href: "/news",
    },
    {
      title: "ランキング",
      description: "人気の高い銘柄を表示",
      icon: "📈",
      href: "/ranking",
    },
    {
      title: "投資クイズ",
      description: "投資知識を楽しく学べる",
      icon: "🧠",
      href: "/quiz",
    },
    {
      title: "AIディベート",
      description: "複数AIを活用した株価分析",
      icon: "🤖",
      href: "/ai-debate",
    },
    {
      title: "アラート",
      description: "株価変動の通知設定機能",
      icon: "🔔",
      href: "/alerts",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <Header />
      <main>
        <h1>株価分析 (kabu-ana)</h1>
        <p className="subtitle">AI株価分析のためのツール</p>
        <div className="status">
          🎉 ようこそ、{user.displayName || user.email}さん！
        </div>

        <h2>機能一覧</h2>
        <div className="features">
          {features.map((feature, index) => (
            <a key={index} href={feature.href} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </a>
          ))}
        </div>
      </main>
    </>
  );
}
