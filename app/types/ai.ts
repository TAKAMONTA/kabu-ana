// AI分析関連の型定義

export interface StockInfo {
  code: string;
  name: string;
  currentPrice?: number;
  price?: number; // 後方互換性のため
  change?: number;
  changePercent?: number;
  volume?: number;
  market: "JP" | "US";
  currency: string;
  lastUpdated: string;
  dataSource: string;
}

export interface CompanyOverview {
  business: string;
  description: string;
  founded: string;
  employees: number;
  headquarters: string;
  website: string;
  industry: string;
  sector: string;
}

export interface BasicMetrics {
  dividend: number;
  dividendYield: number;
  per: number;
  pbr: number;
  roe: number;
  eps: number;
  bps: number;
  marketCap: number;
  revenueGrowth?: number;
}

export interface AIScores {
  investmentScore: number;
  growthPrediction: number;
  riskAssessment: number;
  aiConfidence: number;
}

export interface FinancialHealth {
  profitability: number;
  stability: number;
  growth: number;
  efficiency: number;
  liquidity: number;
}

export interface MarketSentiment {
  sentiment?: string;
  newsScore?: number;
  analystRating?: string | number;
  socialMention?: number;
  institutionalFlow?: number;
  targetPrice?: number;
  consensus?: string;
  newsSentiment?: string;
}

export interface Competitor {
  name: string;
  score: number;
  change: number;
}

export interface TechnicalIndicators {
  trend?: string;
  rsi?: number;
  sma20?: number;
  sma50?: number;
  volume?: string;
  volatility?: number;
  support?: number;
  resistance?: number;
  momentum?: string;
}

export interface InvestmentStyles {
  growth?: number | boolean;
  value?: number | boolean;
  dividend?: number | boolean;
  momentum?: number | boolean;
  quality?: number;
}

export interface AIAnalysisData {
  stockInfo: StockInfo;
  companyOverview: CompanyOverview;
  basicMetrics: BasicMetrics;
  aiScores: AIScores;
  financialHealth: FinancialHealth;
  marketSentiment: MarketSentiment;
  competitors: Competitor[];
  technicalIndicators: TechnicalIndicators;
  investmentStyles: InvestmentStyles;
  risks?: string[];
  opportunities?: string[];
  aiSummary?: string;
  analysis?: string;
  analysisDate: string;
  progress?: AnalysisProgress;
}

export interface AnalysisRequest {
  query: string;
  market?: "JP" | "US";
  perplexityData?: any;
}

export interface AnalysisResponse {
  success: boolean;
  data?: AIAnalysisData;
  error?: string;
}

export interface AnalysisProgress {
  currentStep: number;
  totalSteps: number;
  status: "pending" | "processing" | "completed" | "failed";
  message: string;
}

export interface AnalysisStep {
  step: number;
  name: string;
  status: "pending" | "processing" | "completed" | "failed";
  startTime?: string;
  endTime?: string;
  error?: string;
}
