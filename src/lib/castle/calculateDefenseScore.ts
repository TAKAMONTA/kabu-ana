import {
  FinancialMetricsRaw,
  FinancialScores,
  CastleRank,
  CastleRankInfo,
} from "@/components/castle/types";

/**
 * 各指標の重み付け
 */
const WEIGHTS = {
  equityRatio: 0.3, // 自己資本比率: 30%
  currentRatio: 0.2, // 流動比率: 20%
  fixedRatio: 0.2, // 固定比率: 20%
  cashRatio: 0.15, // 現金比率: 15%
  interestCoverageRatio: 0.15, // ICR: 15%
};

/**
 * ランク定義
 */
const RANK_DEFINITIONS: Record<CastleRank, CastleRankInfo> = {
  S: {
    rank: "S",
    rankName: "天下の名城",
    description: "財務基盤が極めて堅固。石垣も天守も完璧な状態の名城です。",
    minScore: 90,
    maxScore: 100,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
  },
  A: {
    rank: "A",
    rankName: "堅城",
    description: "財務基盤が非常に安定。立派な石垣と堅牢な構造を持つ城です。",
    minScore: 75,
    maxScore: 89,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  B: {
    rank: "B",
    rankName: "良城",
    description: "財務基盤は良好。しっかりとした石垣と整備された城です。",
    minScore: 60,
    maxScore: 74,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  C: {
    rank: "C",
    rankName: "普通の城",
    description: "財務基盤は標準的。一部補修が必要な箇所がある城です。",
    minScore: 45,
    maxScore: 59,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  D: {
    rank: "D",
    rankName: "要注意城",
    description: "財務基盤に注意が必要。石垣にひび割れや草が生えている城です。",
    minScore: 25,
    maxScore: 44,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  E: {
    rank: "E",
    rankName: "危険城",
    description:
      "財務基盤に問題あり。石垣が崩壊し、門も壊れた廃城に近い状態です。",
    minScore: 0,
    maxScore: 24,
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
};

/**
 * 自己資本比率のスコアを計算（40%以上で満点）
 */
function calculateEquityRatioScore(ratio: number | null): number {
  if (ratio === null) return 50; // データなしは中間値
  if (ratio >= 40) return 100;
  if (ratio <= 0) return 0;
  return (ratio / 40) * 100;
}

/**
 * 流動比率のスコアを計算（200%以上で満点）
 */
function calculateCurrentRatioScore(ratio: number | null): number {
  if (ratio === null) return 50;
  if (ratio >= 200) return 100;
  if (ratio <= 50) return 0;
  return ((ratio - 50) / 150) * 100;
}

/**
 * 固定比率のスコアを計算（100%以下で満点、低いほど良い）
 */
function calculateFixedRatioScore(ratio: number | null): number {
  if (ratio === null) return 50;
  if (ratio <= 100) return 100;
  if (ratio >= 300) return 0;
  return ((300 - ratio) / 200) * 100;
}

/**
 * 現金比率のスコアを計算（30%以上で満点）
 */
function calculateCashRatioScore(ratio: number | null): number {
  if (ratio === null) return 50;
  if (ratio >= 30) return 100;
  if (ratio <= 0) return 0;
  return (ratio / 30) * 100;
}

/**
 * ICRのスコアを計算（10倍以上で満点）
 */
function calculateICRScore(icr: number | null): number {
  if (icr === null) return 50;
  if (icr >= 10) return 100;
  if (icr <= 1) return 0;
  return ((icr - 1) / 9) * 100;
}

/**
 * 各指標のスコアを計算
 */
export function calculateIndividualScores(
  metrics: FinancialMetricsRaw
): FinancialScores {
  return {
    equityRatio: Math.round(calculateEquityRatioScore(metrics.equityRatio)),
    currentRatio: Math.round(calculateCurrentRatioScore(metrics.currentRatio)),
    fixedRatio: Math.round(calculateFixedRatioScore(metrics.fixedRatio)),
    cashRatio: Math.round(calculateCashRatioScore(metrics.cashRatio)),
    interestCoverageRatio: Math.round(
      calculateICRScore(metrics.interestCoverageRatio)
    ),
  };
}

/**
 * 総合スコアを計算
 */
export function calculateTotalScore(scores: FinancialScores): number {
  const weightedScore =
    scores.equityRatio * WEIGHTS.equityRatio +
    scores.currentRatio * WEIGHTS.currentRatio +
    scores.fixedRatio * WEIGHTS.fixedRatio +
    scores.cashRatio * WEIGHTS.cashRatio +
    scores.interestCoverageRatio * WEIGHTS.interestCoverageRatio;

  return Math.round(weightedScore);
}

/**
 * スコアからランクを判定
 */
export function determineRank(totalScore: number): CastleRank {
  if (totalScore >= 90) return "S";
  if (totalScore >= 75) return "A";
  if (totalScore >= 60) return "B";
  if (totalScore >= 45) return "C";
  if (totalScore >= 25) return "D";
  return "E";
}

/**
 * ランクの詳細情報を取得
 */
export function getRankInfo(rank: CastleRank): CastleRankInfo {
  return RANK_DEFINITIONS[rank];
}

/**
 * 総合評価を実行
 */
export function evaluateFinancialDefense(metrics: FinancialMetricsRaw): {
  scores: FinancialScores;
  totalScore: number;
  rank: CastleRank;
  rankInfo: CastleRankInfo;
} {
  const scores = calculateIndividualScores(metrics);
  const totalScore = calculateTotalScore(scores);
  const rank = determineRank(totalScore);
  const rankInfo = getRankInfo(rank);

  return { scores, totalScore, rank, rankInfo };
}
