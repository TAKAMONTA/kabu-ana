"use client";

import { useId } from "react";

/**
 * Constellation × Wave — AI シグナルネットワークと市場トレンドを抽象化した
 * ブランド SVG。Linear/Vercel 系の minimal premium。
 * - メイン: 流動グラデのトレンド曲線
 * - 中央/右上に拡張する pulse 波紋（radar ping）
 * - 散らばる constellation node + 接続 dash 線
 * - 2 つの控えめ accent bar が「データ」を暗示
 * ダークモード自動対応 (HSL 変数使用)。
 */
export function HeroIllustration({ className = "" }: { className?: string }) {
  const id = useId();
  const wave = `${id}-wave`;
  const node = `${id}-node`;
  const glow = `${id}-glow`;

  return (
    <svg
      viewBox="0 0 320 140"
      role="img"
      aria-label="AI シグナルネットワークと市場トレンドの抽象イラスト"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={wave} x1="0" y1="1" x2="1" y2="0">
          <stop
            offset="0%"
            stopColor="hsl(var(--primary))"
            stopOpacity="0.95"
          />
          <stop offset="100%" stopColor="hsl(265 85% 65%)" />
        </linearGradient>
        <linearGradient id={node} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(265 85% 65%)" />
        </linearGradient>
        <radialGradient id={glow} cx="62%" cy="48%" r="55%">
          <stop offset="0%" stopColor="hsl(var(--primary) / 0.20)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* soft glow halo */}
      <ellipse cx="200" cy="68" rx="175" ry="68" fill={`url(#${glow})`} />

      {/* single faint guide line */}
      <line
        x1="20"
        y1="76"
        x2="300"
        y2="76"
        stroke="hsl(var(--border))"
        strokeWidth="0.5"
        opacity="0.35"
      />

      {/* subtle accent bars (data hint, not literal candles) */}
      <g opacity="0.4">
        <rect
          x="74"
          y="86"
          width="4"
          height="16"
          rx="1.5"
          fill="hsl(160 60% 50%)"
        />
        <rect
          x="186"
          y="48"
          width="4"
          height="16"
          rx="1.5"
          fill="hsl(265 85% 65%)"
        />
      </g>

      {/* main trend wave — bold gradient stroke */}
      <path
        d="M 20 112 Q 70 100 110 86 T 200 52 T 295 22"
        stroke={`url(#${wave})`}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* large pulse ring at apex */}
      <g>
        <circle
          cx="200"
          cy="52"
          r="10"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.2"
        >
          <animate
            attributeName="r"
            values="8;28;8"
            dur="3.4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.55;0;0.55"
            dur="3.4s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="200" cy="52" r="3.5" fill={`url(#${node})`} />
      </g>

      {/* secondary pulse ring upper-right */}
      <g>
        <circle
          cx="270"
          cy="32"
          r="6"
          fill="none"
          stroke="hsl(265 85% 65%)"
          strokeWidth="1"
        >
          <animate
            attributeName="r"
            values="5;20;5"
            dur="2.8s"
            repeatCount="indefinite"
            begin="0.6s"
          />
          <animate
            attributeName="opacity"
            values="0.6;0;0.6"
            dur="2.8s"
            repeatCount="indefinite"
            begin="0.6s"
          />
        </circle>
        <circle cx="270" cy="32" r="3" fill="hsl(265 85% 65%)" />
      </g>

      {/* tertiary pulse ring lower-left (smaller, slower) */}
      <g>
        <circle
          cx="80"
          cy="98"
          r="5"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="0.8"
        >
          <animate
            attributeName="r"
            values="4;15;4"
            dur="3.8s"
            repeatCount="indefinite"
            begin="1.2s"
          />
          <animate
            attributeName="opacity"
            values="0.45;0;0.45"
            dur="3.8s"
            repeatCount="indefinite"
            begin="1.2s"
          />
        </circle>
        <circle cx="80" cy="98" r="2.5" fill={`url(#${node})`} />
      </g>

      {/* constellation: scattered network nodes */}
      <g fill={`url(#${node})`}>
        <circle cx="48" cy="58" r="2" opacity="0.75" />
        <circle cx="130" cy="42" r="2.2" opacity="0.85" />
        <circle cx="156" cy="98" r="1.8" opacity="0.65" />
        <circle cx="232" cy="86" r="2.2" opacity="0.8" />
        <circle cx="248" cy="20" r="1.8" opacity="0.7" />
      </g>

      {/* dashed connecting lines (constellation feel) */}
      <g
        stroke={`url(#${wave})`}
        strokeWidth="0.6"
        opacity="0.45"
        strokeDasharray="2 2.5"
        fill="none"
      >
        <line x1="48" y1="58" x2="130" y2="42" />
        <line x1="130" y1="42" x2="200" y2="52" />
        <line x1="200" y1="52" x2="232" y2="86" />
        <line x1="200" y1="52" x2="248" y2="20" />
        <line x1="248" y1="20" x2="270" y2="32" />
        <line x1="80" y1="98" x2="156" y2="98" />
      </g>

      {/* sparkle accents */}
      <g fill="hsl(var(--primary))">
        <circle cx="106" cy="56" r="1.4" opacity="0.6">
          <animate
            attributeName="opacity"
            values="0;0.85;0"
            dur="3.2s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="222" cy="42" r="1.4" opacity="0.6">
          <animate
            attributeName="opacity"
            values="0;0.85;0"
            dur="3.2s"
            repeatCount="indefinite"
            begin="1.4s"
          />
        </circle>
        <circle cx="172" cy="116" r="1.2" opacity="0.5">
          <animate
            attributeName="opacity"
            values="0;0.7;0"
            dur="3.5s"
            repeatCount="indefinite"
            begin="2.2s"
          />
        </circle>
      </g>
    </svg>
  );
}
