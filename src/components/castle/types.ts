// 企業城郭図鑑の型定義

/**
 * 財務指標の生データ
 */
export interface FinancialMetricsRaw {
  /** 自己資本比率 (%) */
  equityRatio: number | null;
  /** 流動比率 (%) */
  currentRatio: number | null;
  /** 固定比率 (%) */
  fixedRatio: number | null;
  /** 現金比率 (%) */
  cashRatio: number | null;
  /** インタレスト・カバレッジ・レシオ */
  interestCoverageRatio: number | null;
}

/**
 * 各指標のスコア（0-100）
 */
export interface FinancialScores {
  equityRatio: number;
  currentRatio: number;
  fixedRatio: number;
  cashRatio: number;
  interestCoverageRatio: number;
}

/**
 * 城のランク
 */
export type CastleRank = "S" | "A" | "B" | "C" | "D" | "E";

/**
 * ランクの詳細情報
 */
export interface CastleRankInfo {
  rank: CastleRank;
  rankName: string;
  description: string;
  minScore: number;
  maxScore: number;
  color: string;
  bgColor: string;
}

/**
 * APIレスポンスの型
 */
export interface FinancialMetricsResponse {
  symbol: string;
  companyName: string;
  metrics: FinancialMetricsRaw;
  scores: FinancialScores;
  totalScore: number;
  rank: CastleRank;
  rankInfo: CastleRankInfo;
  imageUrl?: string;
}

/**
 * FMP Balance Sheet データ
 */
export interface FMPBalanceSheet {
  date: string;
  symbol: string;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalStockholdersEquity: number;
  totalCurrentAssets: number;
  totalCurrentLiabilities: number;
  totalNonCurrentAssets: number;
  totalNonCurrentLiabilities: number;
  cashAndCashEquivalents: number;
  shortTermInvestments: number;
  netReceivables: number;
  inventory: number;
  propertyPlantEquipmentNet: number;
  longTermDebt: number;
  shortTermDebt: number;
}

/**
 * FMP Income Statement データ
 */
export interface FMPIncomeStatement {
  date: string;
  symbol: string;
  revenue: number;
  operatingIncome: number;
  interestExpense: number;
  ebitda: number;
  netIncome: number;
}

/**
 * 城郭ビジュアライザーのprops
 */
export interface CastleVisualizerProps {
  symbol?: string;
  onClose?: () => void;
}
