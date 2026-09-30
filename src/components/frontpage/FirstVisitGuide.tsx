"use client";

import { useEffect, useState } from "react";
import { Search, Sparkles, Star, X } from "lucide-react";

const STORAGE_KEY = "kabuana:first-visit-guide-dismissed";

const STEPS = [
  { icon: Search, title: "銘柄を検索", body: "企業名・コードを入力" },
  { icon: Sparkles, title: "AIが要点整理", body: "業績・ニュース・リスク" },
  { icon: Star, title: "★で登録", body: "毎朝ダイジェストで追える" },
];

/** 一度検索したら次回以降はガイドを出さない */
export function markFirstVisitGuideSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // プライベートモード等で保存できなくても表示が消えないだけなので無視する
  }
}

export function FirstVisitGuide() {
  // SSR と初回描画では出さず、保存状態を読んでから表示する（ハイドレーション差分防止）
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(STORAGE_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <section
      aria-label="はじめての方へ"
      className="relative rounded-lg border border-primary/25 bg-primary/5 p-3 sm:p-4"
    >
      <button
        type="button"
        onClick={() => {
          markFirstVisitGuideSeen();
          setVisible(false);
        }}
        aria-label="ガイドを閉じる"
        className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="pr-8 text-sm font-semibold">
        銘柄を入れるだけで、株価・業績・ニュースをAIが30秒で整理します
      </p>
      <ol className="mt-3 grid grid-cols-3 gap-2">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="min-w-0 rounded-md border bg-background/80 p-2 text-center"
          >
            <step.icon className="mx-auto h-4 w-4 text-primary" />
            <p className="mt-1 text-xs font-semibold">
              {index + 1}. {step.title}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
