import axios from "axios";

const FMP_BASE_URL = "https://financialmodelingprep.com/api/v3";

export interface FMPCompanyProfile {
  symbol: string;
  price: number;
  beta: number;
  volAvg: number;
  mktCap: number;
  lastDiv: number;
  range: string;
  changes: number;
  companyName: string;
  currency: string;
  cik: string;
  isin: string;
  cusip: string;
  exchange: string;
  exchangeShortName: string;
  industry: string;
  website: string;
  description: string;
  ceo: string;
  sector: string;
  country: string;
  fullTimeEmployees: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  dcfDiff: number;
  dcf: number;
  image: string;
  ipoDate: string;
  defaultImage: boolean;
  isEtf: boolean;
  isActivelyTrading: boolean;
  isAdr: boolean;
  isFund: boolean;
}

export interface FMPQuote {
  symbol: string;
  name: string;
  price: number;
  changesPercentage: number;
  change: number;
  dayLow: number;
  dayHigh: number;
  yearHigh: number;
  yearLow: number;
  marketCap: number;
  priceAvg50: number;
  priceAvg200: number;
  exchange: string;
  volume: number;
  avgVolume: number;
  open: number;
  previousClose: number;
  eps: number;
  pe: number;
  sharesOutstanding: number;
  timestamp: number;
}

export interface FMPFinancialStatement {
  date: string;
  symbol: string;
  reportedCurrency: string;
  cik: string;
  fillingDate: string;
  acceptedDate: string;
  calendarYear: string;
  period: string;
  revenue: number;
  costOfRevenue: number;
  grossProfit: number;
  grossProfitRatio: number;
  researchAndDevelopmentExpenses: number;
  generalAndAdministrativeExpenses: number;
  sellingAndMarketingExpenses: number;
  sellingGeneralAndAdministrativeExpenses: number;
  otherExpenses: number;
  operatingExpenses: number;
  costAndExpenses: number;
  interestIncome: number;
  interestExpense: number;
  depreciationAndAmortization: number;
  ebitda: number;
  ebitdaratio: number;
  operatingIncome: number;
  totalOtherIncomeExpensesNet: number;
  incomeBeforeTax: number;
  incomeBeforeTaxRatio: number;
  incomeTaxExpense: number;
  netIncome: number;
  netIncomeRatio: number;
  eps: number;
  epsdiluted: number;
  weightedAverageShsOut: number;
  weightedAverageShsOutDil: number;
  link: string;
  finalLink: string;
}

export interface FMPKeyMetrics {
  symbol: string;
  date: string;
  period: string;
  revenuePerShare: number;
  netIncomePerShare: number;
  operatingCashFlowPerShare: number;
  freeCashFlowPerShare: number;
  cashPerShare: number;
  bookValuePerShare: number;
  tangibleBookValuePerShare: number;
  shareholdersEquityPerShare: number;
  interestDebtPerShare: number;
  marketCap: number;
  enterpriseValue: number;
  peRatio: number;
  priceToSalesRatio: number;
  pocfratio: number;
  pfcfRatio: number;
  pbRatio: number;
  ptbRatio: number;
  evToSales: number;
  enterpriseValueOverEBITDA: number;
  evToOperatingCashFlow: number;
  evToFreeCashFlow: number;
  earningsYield: number;
  freeCashFlowYield: number;
  debtToEquity: number;
  debtToAssets: number;
  netDebtToEBITDA: number;
  currentRatio: number;
  interestCoverage: number;
  incomeQuality: number;
  dividendYield: number;
  payoutRatio: number;
  salesGeneralAndAdministrativeToRevenue: number;
  researchAndDevelopmentToRevenue: number;
  intangiblesToTotalAssets: number;
  capexToOperatingCashFlow: number;
  capexToRevenue: number;
  capexToDepreciation: number;
  stockBasedCompensationToRevenue: number;
  grahamNumber: number;
  roic: number;
  returnOnTangibleAssets: number;
  grahamNetNet: number;
  workingCapital: number;
  tangibleAssetValue: number;
  netCurrentAssetValue: number;
  investedCapital: number;
  averageReceivables: number;
  averagePayables: number;
  averageInventory: number;
  daysSalesOutstanding: number;
  daysPayablesOutstanding: number;
  daysOfInventoryOnHand: number;
  receivablesTurnover: number;
  payablesTurnover: number;
  inventoryTurnover: number;
  roe: number;
  capexPerShare: number;
}

export class FMPClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * 企業プロファイルを取得
   */
  async getCompanyProfile(symbol: string): Promise<FMPCompanyProfile | null> {
    try {
      const response = await axios.get(`${FMP_BASE_URL}/profile/${symbol}`, {
        params: {
          apikey: this.apiKey,
        },
      });

      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return null;
    } catch (error: any) {
      console.error("FMP企業プロファイル取得エラー:", error.message);
      return null;
    }
  }

  /**
   * リアルタイム株価データを取得
   */
  async getQuote(symbol: string): Promise<FMPQuote | null> {
    try {
      const response = await axios.get(`${FMP_BASE_URL}/quote/${symbol}`, {
        params: {
          apikey: this.apiKey,
        },
      });

      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return null;
    } catch (error: any) {
      console.error("FMP株価データ取得エラー:", error.message);
      return null;
    }
  }

  /**
   * 財務諸表を取得
   */
  async getFinancialStatements(
    symbol: string,
    limit: number = 1
  ): Promise<FMPFinancialStatement[]> {
    try {
      const response = await axios.get(
        `${FMP_BASE_URL}/income-statement/${symbol}`,
        {
          params: {
            apikey: this.apiKey,
            limit,
          },
        }
      );

      return response.data || [];
    } catch (error: any) {
      console.error("FMP財務諸表取得エラー:", error.message);
      return [];
    }
  }

  /**
   * 主要指標を取得
   */
  async getKeyMetrics(symbol: string, limit: number = 1): Promise<FMPKeyMetrics[]> {
    try {
      const response = await axios.get(`${FMP_BASE_URL}/key-metrics/${symbol}`, {
        params: {
          apikey: this.apiKey,
          limit,
        },
      });

      return response.data || [];
    } catch (error: any) {
      console.error("FMP主要指標取得エラー:", error.message);
      return [];
    }
  }

  /**
   * 企業検索
   */
  async searchCompany(query: string): Promise<FMPCompanyProfile[]> {
    try {
      const response = await axios.get(`${FMP_BASE_URL}/search`, {
        params: {
          query,
          apikey: this.apiKey,
          limit: 10,
        },
      });

      return response.data || [];
    } catch (error: any) {
      console.error("FMP企業検索エラー:", error.message);
      return [];
    }
  }

  /**
   * 履歴株価データを取得
   */
  async getHistoricalPrice(
    symbol: string,
    from: string,
    to: string
  ): Promise<any[]> {
    try {
      const response = await axios.get(
        `${FMP_BASE_URL}/historical-price-full/${symbol}`,
        {
          params: {
            apikey: this.apiKey,
            from,
            to,
          },
        }
      );

      return response.data?.historical || [];
    } catch (error: any) {
      console.error("FMP履歴株価取得エラー:", error.message);
      return [];
    }
  }
}
