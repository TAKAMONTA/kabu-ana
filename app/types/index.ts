export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  plan: "free" | "premium";
  createdAt: Date;
  lastLoginAt: Date;
  preferences: {
    theme: "light" | "dark";
    language: "ja" | "en";
    notifications: boolean;
  };
}

export interface StockAnalysisRequest {
  stockCode: string;
  market: "JP" | "US";
  step: number;
  previousData?: any;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface RateLimitResponse {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

export interface Analysis {
  id: string;
  userId: string;
  stockCode: string;
  stockName: string;
  market: "JP" | "US";
  analysisData: {
    stockInfo: {
      code: string;
      name: string;
      market: string;
      currentPrice: number;
      priceChange: number;
      priceChangePercent: number;
    };
    companyOverview: {
      description: string;
      industry: string;
      sector: string;
      employees: number;
      founded: string;
      headquarters: string;
      website: string;
    };
    metrics: {
      per: number;
      pbr: number;
      roe: number;
      roa: number;
      dividendYield: number;
      marketCap: number;
    };
    aiScore: {
      overall: number;
      growth: number;
      profitability: number;
      stability: number;
      valuation: number;
    };
  };
  createdAt: Date;
  isPublic: boolean;
  tags?: string[];
}

export interface Favorite {
  id: string;
  userId: string;
  stockCode: string;
  stockName: string;
  market: "JP" | "US";
  addedAt: Date;
  notes?: string;
}

export interface UserStats {
  userId: string;
  totalAnalyses: number;
  favoriteCount: number;
  lastAnalysisAt: Date | null;
  monthlyUsage: {
    [yearMonth: string]: {
      analyses: number;
      favorites: number;
    };
  };
  streakDays: number;
  achievements: string[];
}

export interface FirebaseError {
  code: string;
  message: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: User;
}

export interface StockInfo {
  code: string;
  name: string;
  market: string;
  currentPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
}

export interface CompanyInfo {
  name: string;
  description?: string;
  industry?: string;
  sector?: string;
  employees?: number;
  founded?: string;
  headquarters?: string;
  website?: string;
}

export interface AIAnalysisResponse {
  companyName?: string;
  price?: number;
  change?: number;
  analysis?: string;
  score?: number;
  recommendation?: string;
}
