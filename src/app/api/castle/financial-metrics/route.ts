import { NextResponse } from "next/server";
import axios from "axios";
import {
  FinancialMetricsRaw,
  FinancialMetricsResponse,
  FMPBalanceSheet,
  FMPIncomeStatement,
} from "@/components/castle/types";
import { evaluateFinancialDefense } from "@/lib/castle/calculateDefenseScore";
import { EdinetDBClient } from "@/lib/api/edinetdb";

const FMP_BASE_URL = "https://financialmodelingprep.com/api/v3";
const FMP_API_KEY = process.env.FMP_API_KEY;

/**
 * Balance Sheet データを取得
 */
async function fetchBalanceSheet(
  symbol: string
): Promise<FMPBalanceSheet | null> {
  try {
    const response = await axios.get(
      `${FMP_BASE_URL}/balance-sheet-statement/${symbol}`,
      {
        params: {
          apikey: FMP_API_KEY,
          limit: 1,
        },
      }
    );

    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (error) {
    console.error("Balance Sheet取得エラー:", error);
    return null;
  }
}

/**
 * Income Statement データを取得
 */
async function fetchIncomeStatement(
  symbol: string
): Promise<FMPIncomeStatement | null> {
  try {
    const response = await axios.get(
      `${FMP_BASE_URL}/income-statement/${symbol}`,
      {
        params: {
          apikey: FMP_API_KEY,
          limit: 1,
        },
      }
    );

    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (error) {
    console.error("Income Statement取得エラー:", error);
    return null;
  }
}

/**
 * Key Metrics データを取得
 */
async function fetchKeyMetrics(symbol: string): Promise<any | null> {
  try {
    const response = await axios.get(`${FMP_BASE_URL}/key-metrics/${symbol}`, {
      params: {
        apikey: FMP_API_KEY,
        limit: 1,
      },
    });

    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (error) {
    console.error("Key Metrics取得エラー:", error);
    return null;
  }
}

/**
 * Ratios データを取得
 */
async function fetchRatios(symbol: string): Promise<any | null> {
  try {
    const response = await axios.get(`${FMP_BASE_URL}/ratios/${symbol}`, {
      params: {
        apikey: FMP_API_KEY,
        limit: 1,
      },
    });

    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (error) {
    console.error("Ratios取得エラー:", error);
    return null;
  }
}

/**
 * 企業プロファイルを取得
 */
async function fetchCompanyProfile(symbol: string): Promise<any | null> {
  try {
    const response = await axios.get(`${FMP_BASE_URL}/profile/${symbol}`, {
      params: {
        apikey: FMP_API_KEY,
      },
    });

    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (error) {
    console.error("Company Profile取得エラー:", error);
    return null;
  }
}

/**
 * 財務指標を計算（欠損値を補完するロジック付き）
 */
function calculateFinancialMetrics(
  balanceSheet: FMPBalanceSheet | null,
  incomeStatement: FMPIncomeStatement | null,
  keyMetrics: any | null,
  ratios: any | null
): FinancialMetricsRaw {
  const metrics: FinancialMetricsRaw = {
    equityRatio: null,
    currentRatio: null,
    fixedRatio: null,
    cashRatio: null,
    interestCoverageRatio: null,
  };

  // 1. 自己資本比率 = 自己資本 / 総資産 × 100
  if (balanceSheet?.totalAssets && balanceSheet?.totalStockholdersEquity) {
    metrics.equityRatio =
      (balanceSheet.totalStockholdersEquity / balanceSheet.totalAssets) * 100;
  } else if (keyMetrics?.debtToEquity) {
    // D/E比率から逆算: 自己資本比率 ≈ 100 / (1 + D/E)
    metrics.equityRatio = 100 / (1 + keyMetrics.debtToEquity);
  }

  // 2. 流動比率 = 流動資産 / 流動負債 × 100
  if (ratios?.currentRatio) {
    metrics.currentRatio = ratios.currentRatio * 100;
  } else if (keyMetrics?.currentRatio) {
    metrics.currentRatio = keyMetrics.currentRatio * 100;
  } else if (
    balanceSheet?.totalCurrentAssets &&
    balanceSheet?.totalCurrentLiabilities
  ) {
    metrics.currentRatio =
      (balanceSheet.totalCurrentAssets / balanceSheet.totalCurrentLiabilities) *
      100;
  }

  // 3. 固定比率 = 固定資産 / 自己資本 × 100
  if (balanceSheet?.totalNonCurrentAssets && balanceSheet?.totalStockholdersEquity) {
    metrics.fixedRatio =
      (balanceSheet.totalNonCurrentAssets /
        balanceSheet.totalStockholdersEquity) *
      100;
  } else if (
    balanceSheet?.propertyPlantEquipmentNet &&
    balanceSheet?.totalStockholdersEquity
  ) {
    // PPEを固定資産の代理として使用
    metrics.fixedRatio =
      (balanceSheet.propertyPlantEquipmentNet /
        balanceSheet.totalStockholdersEquity) *
      100;
  }

  // 4. 現金比率 = 現金及び現金同等物 / 流動負債 × 100
  if (ratios?.cashRatio) {
    metrics.cashRatio = ratios.cashRatio * 100;
  } else if (
    balanceSheet?.cashAndCashEquivalents &&
    balanceSheet?.totalCurrentLiabilities
  ) {
    metrics.cashRatio =
      (balanceSheet.cashAndCashEquivalents /
        balanceSheet.totalCurrentLiabilities) *
      100;
  }

  // 5. ICR = 営業利益（またはEBIT） / 支払利息
  if (ratios?.interestCoverage) {
    metrics.interestCoverageRatio = ratios.interestCoverage;
  } else if (keyMetrics?.interestCoverage) {
    metrics.interestCoverageRatio = keyMetrics.interestCoverage;
  } else if (
    incomeStatement?.operatingIncome &&
    incomeStatement?.interestExpense &&
    incomeStatement.interestExpense > 0
  ) {
    metrics.interestCoverageRatio =
      incomeStatement.operatingIncome / incomeStatement.interestExpense;
  } else if (
    incomeStatement?.ebitda &&
    incomeStatement?.interestExpense &&
    incomeStatement.interestExpense > 0
  ) {
    // EBITDAを代わりに使用
    metrics.interestCoverageRatio =
      incomeStatement.ebitda / incomeStatement.interestExpense;
  }

  return metrics;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const edinetCode = searchParams.get("edinet_code");

    if (!symbol) {
      return NextResponse.json(
        { error: "証券コードが指定されていません" },
        { status: 400 }
      );
    }

    // ===== EDINET DB 経由（日本企業・edinetCode がある場合）=====
    const edinetDbKey = process.env.EDINETDB_API_KEY;
    if (edinetCode && edinetDbKey) {
      try {
        const edinetApi = new EdinetDBClient(edinetDbKey);
        const [ratiosData, companyDetail] = await Promise.all([
          edinetApi.getRatios(edinetCode),
          edinetApi.getCompany(edinetCode),
        ]);

        if (ratiosData) {
          const metrics: FinancialMetricsRaw = {
            equityRatio: ratiosData.equity_ratio != null ? ratiosData.equity_ratio * 100 : null,
            currentRatio: ratiosData.current_ratio != null ? ratiosData.current_ratio * 100 : null,
            fixedRatio: null,
            cashRatio: null,
            interestCoverageRatio: null,
          };
          const evaluation = evaluateFinancialDefense(metrics);
          const response: FinancialMetricsResponse = {
            symbol: symbol.toUpperCase(),
            companyName: companyDetail?.name || symbol.toUpperCase(),
            metrics,
            scores: evaluation.scores,
            totalScore: evaluation.totalScore,
            rank: evaluation.rank,
            rankInfo: evaluation.rankInfo,
          };
          return NextResponse.json(response);
        }
      } catch (e) {
        console.error("EDINET DB castle指標取得エラー:", e);
      }
    }

    // ===== FMP 経由（フォールバック）=====
    if (!FMP_API_KEY) {
      return NextResponse.json(
        { error: "FMP APIキーが設定されていません" },
        { status: 500 }
      );
    }

    // 並行してデータを取得
    const [balanceSheet, incomeStatement, keyMetrics, ratios, profile] =
      await Promise.all([
        fetchBalanceSheet(symbol),
        fetchIncomeStatement(symbol),
        fetchKeyMetrics(symbol),
        fetchRatios(symbol),
        fetchCompanyProfile(symbol),
      ]);

    if (!balanceSheet && !keyMetrics && !ratios) {
      return NextResponse.json(
        { error: "財務データが見つかりませんでした" },
        { status: 404 }
      );
    }

    // 財務指標を計算
    const metrics = calculateFinancialMetrics(
      balanceSheet,
      incomeStatement,
      keyMetrics,
      ratios
    );

    // スコアとランクを評価
    const evaluation = evaluateFinancialDefense(metrics);

    const response: FinancialMetricsResponse = {
      symbol: symbol.toUpperCase(),
      companyName: profile?.companyName || symbol.toUpperCase(),
      metrics,
      scores: evaluation.scores,
      totalScore: evaluation.totalScore,
      rank: evaluation.rank,
      rankInfo: evaluation.rankInfo,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("財務指標取得エラー:", error);
    return NextResponse.json(
      { error: "財務指標の取得に失敗しました: " + error.message },
      { status: 500 }
    );
  }
}
