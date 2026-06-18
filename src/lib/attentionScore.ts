export const ATTENTION_SCORE_THRESHOLDS = {
  high: 0.82,
  medium: 0.68,
} as const;

export type AttentionBadgeTone = "high" | "medium" | "low";

export function shouldShowAttentionScore(scores: number[]): boolean {
  const visibleScores = scores.filter(score => Number.isFinite(score));
  if (visibleScores.length <= 1) return true;

  const firstScore = visibleScores[0];
  return visibleScores.some(score => Math.abs(score - firstScore) >= 0.005);
}

export function getAttentionBadgeTone(score: number): AttentionBadgeTone {
  if (score >= ATTENTION_SCORE_THRESHOLDS.high) return "high";
  if (score >= ATTENTION_SCORE_THRESHOLDS.medium) return "medium";
  return "low";
}

export function formatAttentionScore(score: number): string {
  return `注目度 ${(score * 100).toFixed(0)}%`;
}
