"use client";

import { useId } from "react";

/**
 * 抽象的なローソク足 + AIシグナルノード + トレンドラインを組み合わせた
 * ブランド SVG イラスト。ダークモード自動対応（HSL 変数を使用）。
 * モバイルでは hidden 推奨（密度確保）。
 */
export function HeroIllustration({ className = "" }: { className?: string }) {
  const id = useId();
  const lineGradient = `${id}-line`;
  const glowGradient = `${id}-glow`;

  return (
    <svg
      viewBox="0 0 320 140"
      role="img"
      aria-label="抽象的な株価チャートとAIシグナルネットワークのイラスト"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={lineGradient} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(265 85% 62%)" />
        </linearGradient>
        <radialGradient id={glowGradient} cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor="hsl(var(--primary) / 0.18)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* center glow halo */}
      <ellipse cx="160" cy="80" rx="150" ry="55" fill={`url(#${glowGradient})`} />

      {/* faint grid (chart background) */}
      <g stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.55">
        <line x1="20" y1="55" x2="300" y2="55" />
        <line x1="20" y1="85" x2="300" y2="85" />
        <line x1="20" y1="115" x2="300" y2="115" />
      </g>

      {/* candlesticks */}
      <g>
        {[
          { x: 40, low: 95, high: 60, open: 88, close: 70, up: true },
          { x: 75, low: 100, high: 65, open: 92, close: 78, up: true },
          { x: 110, low: 98, high: 68, open: 75, close: 88, up: false },
          { x: 145, low: 85, high: 50, open: 72, close: 58, up: true },
          { x: 180, low: 88, high: 55, open: 62, close: 70, up: false },
          { x: 215, low: 75, high: 45, open: 65, close: 50, up: true },
          { x: 250, low: 68, high: 40, open: 58, close: 45, up: true },
          { x: 285, low: 62, high: 32, open: 50, close: 38, up: true },
        ].map((c, i) => {
          const color = c.up ? "hsl(160 65% 45%)" : "hsl(0 70% 58%)";
          const top = Math.min(c.open, c.close);
          const height = Math.abs(c.open - c.close);
          return (
            <g key={i}>
              <line
                x1={c.x}
                y1={c.high}
                x2={c.x}
                y2={c.low}
                stroke={color}
                strokeWidth="1"
                opacity="0.85"
              />
              <rect
                x={c.x - 4}
                y={top}
                width={8}
                height={Math.max(height, 2)}
                fill={color}
                opacity="0.85"
                rx="1"
              />
            </g>
          );
        })}
      </g>

      {/* trend curve through closes */}
      <path
        d="M 40 70 Q 75 78 110 88 T 180 70 T 250 50 T 285 38"
        stroke={`url(#${lineGradient})`}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        opacity="0.95"
      />

      {/* AI signal nodes (top, pulsing) */}
      <g>
        <line
          x1="55"
          y1="22"
          x2="160"
          y2="14"
          stroke={`url(#${lineGradient})`}
          strokeWidth="0.6"
          opacity="0.4"
          strokeDasharray="2 2"
        />
        <line
          x1="160"
          y1="14"
          x2="265"
          y2="22"
          stroke={`url(#${lineGradient})`}
          strokeWidth="0.6"
          opacity="0.4"
          strokeDasharray="2 2"
        />

        <line
          x1="55"
          y1="24"
          x2="40"
          y2="60"
          stroke={`url(#${lineGradient})`}
          strokeWidth="0.5"
          opacity="0.35"
        />
        <line
          x1="160"
          y1="16"
          x2="180"
          y2="55"
          stroke={`url(#${lineGradient})`}
          strokeWidth="0.5"
          opacity="0.35"
        />
        <line
          x1="265"
          y1="24"
          x2="285"
          y2="32"
          stroke={`url(#${lineGradient})`}
          strokeWidth="0.5"
          opacity="0.35"
        />

        <circle cx="55" cy="22" r="3.5" fill="hsl(var(--primary))" opacity="0.85">
          <animate
            attributeName="opacity"
            values="0.4;1;0.4"
            dur="2.6s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="r"
            values="3;3.8;3"
            dur="2.6s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="160" cy="14" r="3.5" fill="hsl(265 85% 62%)" opacity="0.9">
          <animate
            attributeName="opacity"
            values="1;0.5;1"
            dur="2.6s"
            repeatCount="indefinite"
            begin="0.7s"
          />
          <animate
            attributeName="r"
            values="3.8;3;3.8"
            dur="2.6s"
            repeatCount="indefinite"
            begin="0.7s"
          />
        </circle>
        <circle cx="265" cy="22" r="3.5" fill="hsl(var(--primary))" opacity="0.85">
          <animate
            attributeName="opacity"
            values="0.4;1;0.4"
            dur="2.6s"
            repeatCount="indefinite"
            begin="1.4s"
          />
          <animate
            attributeName="r"
            values="3;3.8;3"
            dur="2.6s"
            repeatCount="indefinite"
            begin="1.4s"
          />
        </circle>
      </g>

      {/* sparkle accents */}
      <g fill="hsl(var(--primary))" opacity="0.6">
        <circle cx="100" cy="60" r="1.4">
          <animate
            attributeName="opacity"
            values="0;0.85;0"
            dur="3.2s"
            repeatCount="indefinite"
            begin="0.4s"
          />
        </circle>
        <circle cx="225" cy="48" r="1.4">
          <animate
            attributeName="opacity"
            values="0;0.85;0"
            dur="3.2s"
            repeatCount="indefinite"
            begin="1.6s"
          />
        </circle>
      </g>
    </svg>
  );
}
