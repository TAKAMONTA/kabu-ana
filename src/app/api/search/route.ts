import { NextRequest, NextResponse } from "next/server";
import { SerpApiClient } from "@/lib/api/serpapi";
import { FMPClient } from "@/lib/api/fmp";
import { FreeNewsClient } from "@/lib/api/freeNews";
import { EdinetDBClient, isJapaneseQuery, secCodeToFmpSymbol } from "@/lib/api/edinetdb";
import { searchSchema } from "@/lib/validation/schemas";
import { withRateLimit } from "@/lib/utils/rateLimiter";

async function searchHandler(request: NextRequest) {
  try {
    const body = await request.json();

    if (process.env.NODE_ENV === "development") {
      console.log("検索リクエスト受信:", { query: body.query, chartPeriod: body.chartPeriod });
    }

    const validationResult = searchSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map(err => {
        const field = err.path.join(".");
        const fieldName = field === "query" ? "検索クエリ" : field;
        return `${fieldName}: ${err.message}`;
      });
      const mainMessage = validationResult.error.errors[0]?.message || "入力データが無効です";
      return NextResponse.json(
        {
          error: mainMessage,
          message: errorMessages.join("; "),
          details: validationResult.error.errors.map(err => ({
            field: err.path.join("."),
            message: err.message,
            code: err.code,
          })),
        },
        { status: 400 }
      );
    }

    const { query, chartPeriod } = validationResult.data;

    const serpApiKey = process.env.SERPAPI_API_KEY;
    const fmpApiKey = process.env.FMP_API_KEY;
    const edinetDbKey = process.env.EDINETDB_API_KEY;

    if (
      (!serpApiKey || serpApiKey === "your_serpapi_key_here") &&
      (!fmpApiKey || fmpApiKey === "your_fmp_api_key_here") &&
      (!edinetDbKey || edinetDbKey === "")
    ) {
      return NextResponse.json(
        { error: "APIキーが設定されていません。SERPAPI_API_KEY、FMP_API_KEY、またはEDINETDB_API_KEYを設定してください。" },
        { status: 400 }
      );
    }

    const serpApi =
      serpApiKey && serpApiKey !== "your_serpapi_key_here"
        ? new SerpApiClient(serpApiKey)
        : null;
    const fmpApi =
      fmpApiKey && fmpApiKey !== "your_fmp_api_key_here"
        ? new FMPClient(fmpApiKey)
        : null;
    const edinetApi =
      edinetDbKey && edinetDbKey !== ""
        ? new EdinetDBClient(edinetDbKey)
        : null;

    // 結果変数
    let companyInfo: {
      name: string;
      symbol: string;
      market: string;
      price?: number;
      change?: number;
      changePercent?: number;
      description?: string;
      website?: string;
      employees?: string;
      founded?: string;
      headquarters?: string;
    } | null = null;
    let stockData: {
      symbol: string;
      price: number;
      change: number;
      changePercent: number;
      volume: number;
      marketCap: string;
      pe: number;
      eps: number;
      dividend: number;
      high52: number;
      low52: number;
    } | null = null;
    let newsData: Array<{
      title: string;
      snippet: string;
      link: string;
      source: string;
      date: string;
    }> = [];
    let chartData: Array<{
      date: string;
      price: number;
      volume: number;
      keyEvent?: { title: string; link: string; source: string };
    }> = [];
    let financialData: {
      revenue?: string;
      netIncome?: string;
      operatingIncome?: string;
      totalAssets?: string;
      totalLiabilities?: string;
      totalEquity?: string;
      cash?: string;
      eps?: string;
      period?: string;
      equityRatio?: string;
      debtRatio?: string;
      operatingCashFlow?: string;
      investingCashFlow?: string;
      financingCashFlow?: string;
      freeCashFlow?: string;
      grossProfit?: string;
      grossProfitRatio?: string;
      operatingIncomeRatio?: string;
      netIncomeRatio?: string;
    } | null = null;

    // EDINET DB 拡張フィールド
    let edinetCode: string | null = null;
    let accountingStandard: string | null = null;
    let ratios: {
      roe?: number;
      roa?: number;
      operatingMargin?: number;
      netMargin?: number;
      grossMargin?: number;
      equityRatio?: number;
      currentRatio?: number;
      deRatio?: number;
      fcf?: number;
      ebitda?: number;
      revenueGrowth?: number;
      niGrowth?: number;
      revenueCagr3y?: number;
      niCagr3y?: number;
      dividendYield?: number;
    } | null = null;
    let financialHistory: Array<{
      fiscalYear: number;
      revenue?: number;
      operatingIncome?: number;
      netIncome?: number;
      eps?: number;
      totalAssets?: number;
      cfOperating?: number;
    }> | null = null;

    // ===== STEP 1: EDINET DB（日本企業） =====
    if (edinetApi && isJapaneseQuery(query)) {
      try {
        const results = await edinetApi.searchCompanies(query, 5);
        if (results.length > 0) {
          const company = results[0];
          edinetCode = company.edinet_code;

          // 詳細・財務・指標を並行取得
          const [detail, financials, ratiosData] = await Promise.all([
            edinetApi.getCompany(company.edinet_code),
            edinetApi.getFinancials(company.edinet_code),
            edinetApi.getRatios(company.edinet_code),
          ]);

          accountingStandard = detail?.accounting_standard ?? null;

          // 企業情報の構築
          const fmpSymbol = company.sec_code ? secCodeToFmpSymbol(company.sec_code) : null;
          companyInfo = {
            name: company.name,
            symbol: fmpSymbol ?? company.edinet_code,
            market: "TYO",
            description: undefined,
            headquarters: undefined,
          };

          // 財務時系列から最新年度のデータを取得
          if (financials.length > 0) {
            const sorted = [...financials].sort((a, b) => b.fiscal_year - a.fiscal_year);
            const latest = sorted[0];

            const totalEquity = latest.shareholders_equity ?? latest.net_assets;
            const totalAssets = latest.total_assets;
            const totalLiabilities = totalAssets != null && totalEquity != null
              ? totalAssets - totalEquity
              : latest.total_liabilities;

            const equityRatioPct = totalAssets && totalEquity
              ? ((totalEquity / totalAssets) * 100).toFixed(1) + "%"
              : latest.equity_ratio_official != null
                ? (latest.equity_ratio_official * 100).toFixed(1) + "%"
                : undefined;
            const operatingMarginPct = latest.revenue && latest.operating_income
              ? ((latest.operating_income / latest.revenue) * 100).toFixed(1) + "%"
              : undefined;
            const netMarginPct = latest.revenue && latest.net_income
              ? ((latest.net_income / latest.revenue) * 100).toFixed(1) + "%"
              : undefined;
            const grossMarginPct = latest.revenue && latest.gross_profit
              ? ((latest.gross_profit / latest.revenue) * 100).toFixed(1) + "%"
              : undefined;
            const debtRatioPct = totalAssets && totalLiabilities
              ? ((totalLiabilities / totalAssets) * 100).toFixed(1) + "%"
              : undefined;

            financialData = {
              revenue: latest.revenue?.toString(),
              netIncome: latest.net_income?.toString(),
              operatingIncome: latest.operating_income?.toString(),
              grossProfit: latest.gross_profit?.toString(),
              grossProfitRatio: grossMarginPct,
              operatingIncomeRatio: operatingMarginPct,
              netIncomeRatio: netMarginPct,
              eps: latest.eps?.toString(),
              totalAssets: totalAssets?.toString(),
              totalLiabilities: totalLiabilities?.toString(),
              totalEquity: totalEquity?.toString(),
              cash: latest.cash?.toString(),
              equityRatio: equityRatioPct,
              debtRatio: debtRatioPct,
              operatingCashFlow: latest.cf_operating?.toString(),
              investingCashFlow: latest.cf_investing?.toString(),
              financingCashFlow: latest.cf_financing?.toString(),
              freeCashFlow: latest.cf_operating != null && latest.capex != null
                ? (latest.cf_operating - Math.abs(latest.capex)).toString()
                : undefined,
              period: `FY${latest.fiscal_year}`,
            };

            // 財務履歴（チャート用）
            financialHistory = sorted.slice(0, 6).map(f => ({
              fiscalYear: f.fiscal_year,
              revenue: f.revenue,
              operatingIncome: f.operating_income,
              netIncome: f.net_income,
              eps: f.eps,
              totalAssets: f.total_assets,
              cfOperating: f.cf_operating,
            })).reverse();
          }

          // 計算済み指標
          if (ratiosData) {
            ratios = {
              roe: ratiosData.roe,
              roa: ratiosData.roa,
              operatingMargin: ratiosData.operating_margin,
              netMargin: ratiosData.net_margin,
              grossMargin: ratiosData.gross_margin,
              equityRatio: ratiosData.equity_ratio,
              currentRatio: ratiosData.current_ratio,
              deRatio: ratiosData.de_ratio,
              fcf: ratiosData.fcf,
              ebitda: ratiosData.ebitda,
              revenueGrowth: ratiosData.revenue_growth,
              niGrowth: ratiosData.ni_growth,
              revenueCagr3y: ratiosData.revenue_cagr_3y,
              niCagr3y: ratiosData.ni_cagr_3y,
              dividendYield: ratiosData.dividend_yield,
            };
          }

          // 株価・チャートデータは FMP から補完（証券コードが分かる場合）
          if (fmpApi && fmpSymbol) {
            try {
              const [quote, profile] = await Promise.all([
                fmpApi.getQuote(fmpSymbol as string),
                fmpApi.getCompanyProfile(fmpSymbol as string),
              ]);
              if (quote) {
                stockData = {
                  symbol: quote.symbol,
                  price: quote.price,
                  change: quote.change,
                  changePercent: quote.changesPercentage,
                  volume: quote.volume,
                  marketCap: quote.marketCap.toString(),
                  pe: quote.pe,
                  eps: quote.eps,
                  dividend: 0,
                  high52: quote.yearHigh,
                  low52: quote.yearLow,
                };
                if (companyInfo) {
                  companyInfo.price = quote.price;
                  companyInfo.change = quote.change;
                  companyInfo.changePercent = quote.changesPercentage;
                }
              }
              if (profile) {
                if (companyInfo) {
                  companyInfo.description = profile.description;
                  companyInfo.website = profile.website;
                  companyInfo.employees = profile.fullTimeEmployees;
                  companyInfo.headquarters = `${profile.city}, ${profile.country}`;
                }
              }
            } catch (fmpError) {
              console.error("FMP補完エラー（EDINET後）:", fmpError);
            }
          }

          // ニュース取得
          const freeNewsClient = new FreeNewsClient();
          const freeNews = await freeNewsClient.getComprehensiveNews(
            company.name,
            company.sec_code ?? company.edinet_code,
            5
          );
          if (freeNews.length > 0) {
            newsData = freeNews;
          }
        }
      } catch (edinetError) {
        console.error("EDINET DB APIエラー:", edinetError);
      }
    }

    // ===== STEP 2: FMP（海外企業、または EDINET でヒットしなかった場合） =====
    if (fmpApi && (!companyInfo || !stockData)) {
      try {
        const searchResults = await fmpApi.comprehensiveSearch(query);
        if (searchResults && searchResults.length > 0) {
          const company = searchResults[0];
          const profile = await fmpApi.getCompanyProfile(company.symbol);

          if (profile) {
            companyInfo = companyInfo ?? {
              name: profile.companyName,
              symbol: profile.symbol,
              market: profile.exchangeShortName,
              price: profile.price,
              change: profile.changes,
              changePercent: (profile.changes / profile.price) * 100,
              description: profile.description,
              website: profile.website,
              employees: profile.fullTimeEmployees,
              founded: profile.ipoDate,
              headquarters: `${profile.city}, ${profile.country}`,
            };
          }

          const quote = await fmpApi.getQuote(company.symbol);
          if (quote && !stockData) {
            stockData = {
              symbol: quote.symbol,
              price: quote.price,
              change: quote.change,
              changePercent: quote.changesPercentage,
              volume: quote.volume,
              marketCap: quote.marketCap.toString(),
              pe: quote.pe,
              eps: quote.eps,
              dividend: 0,
              high52: quote.yearHigh,
              low52: quote.yearLow,
            };
          }

          if (!financialData) {
            const [financialStatements, balanceSheets, cashFlows] = await Promise.all([
              fmpApi.getFinancialStatements(company.symbol, 1),
              fmpApi.getBalanceSheet(company.symbol, 1),
              fmpApi.getCashFlowStatement(company.symbol, 1),
            ]);

            const pl = financialStatements?.[0];
            const bs = balanceSheets?.[0];
            const cf = cashFlows?.[0];

            if (pl || bs || cf) {
              const totalAssets = bs?.totalAssets;
              const totalEquity = bs?.totalStockholdersEquity ?? bs?.totalEquity;
              const totalLiabilities = bs?.totalLiabilities;

              financialData = {
                revenue: pl?.revenue?.toString(),
                netIncome: pl?.netIncome?.toString(),
                operatingIncome: pl?.operatingIncome?.toString(),
                grossProfit: pl?.grossProfit?.toString(),
                grossProfitRatio: pl?.grossProfitRatio != null
                  ? (pl.grossProfitRatio * 100).toFixed(1) + "%"
                  : undefined,
                operatingIncomeRatio: pl?.operatingIncome != null && pl?.revenue
                  ? ((pl.operatingIncome / pl.revenue) * 100).toFixed(1) + "%"
                  : undefined,
                netIncomeRatio: pl?.netIncomeRatio != null
                  ? (pl.netIncomeRatio * 100).toFixed(1) + "%"
                  : undefined,
                eps: pl?.eps?.toString(),
                totalAssets: totalAssets?.toString(),
                totalLiabilities: totalLiabilities?.toString(),
                totalEquity: totalEquity?.toString(),
                cash: (bs?.cashAndCashEquivalents ?? bs?.cashAndShortTermInvestments)?.toString(),
                equityRatio: totalAssets && totalEquity
                  ? ((totalEquity / totalAssets) * 100).toFixed(1) + "%"
                  : undefined,
                debtRatio: totalAssets && totalLiabilities
                  ? ((totalLiabilities / totalAssets) * 100).toFixed(1) + "%"
                  : undefined,
                operatingCashFlow: cf?.operatingCashFlow?.toString(),
                investingCashFlow: cf?.netCashUsedForInvestingActivites?.toString(),
                financingCashFlow: cf?.netCashUsedProvidedByFinancingActivities?.toString(),
                freeCashFlow: cf?.freeCashFlow?.toString(),
                period: pl
                  ? `${pl.calendarYear} (${pl.period})`
                  : bs
                    ? `${bs.calendarYear} (${bs.period})`
                    : undefined,
              };
            }
          }

          const keyMetrics = await fmpApi.getKeyMetrics(company.symbol, 1);
          if (keyMetrics?.length > 0 && stockData) {
            stockData.dividend = keyMetrics[0].dividendYield || 0;
          }

          if (newsData.length === 0) {
            const freeNewsClient = new FreeNewsClient();
            const freeNews = await freeNewsClient.getComprehensiveNews(
              company.name || company.companyName,
              company.symbol,
              5
            );
            if (freeNews.length > 0) {
              newsData = freeNews;
            }
          }
        }
      } catch (error) {
        console.error("FMP APIエラー:", error);
      }
    }

    // ===== STEP 3: SERPAPI フォールバック =====
    if (serpApi && (!companyInfo || !stockData)) {
      try {
        let serpCompanyInfo = await serpApi.searchCompany(query);
        if (!serpCompanyInfo) {
          serpCompanyInfo = await serpApi.searchCompanyByGoogle(query);
        }
        if (serpCompanyInfo) {
          companyInfo = companyInfo ?? serpCompanyInfo;

          const serpStockData = await serpApi.getStockData(serpCompanyInfo.symbol);
          stockData = stockData ?? serpStockData;

          const serpNews = await serpApi.getCompanyNews(serpCompanyInfo.symbol, 5);
          if (serpNews?.length > 0) {
            newsData = serpNews;
          } else {
            const googleNews = await serpApi.getCompanyNewsFromGoogle(
              serpCompanyInfo.symbol,
              serpCompanyInfo.name,
              5
            );
            if (googleNews?.length > 0) {
              newsData = googleNews;
            }
          }
          chartData = await serpApi.getChartData(serpCompanyInfo.symbol, chartPeriod);
          financialData = financialData ?? (await serpApi.getFinancialData(serpCompanyInfo.symbol));
        }
      } catch (error) {
        console.error("SERPAPI エラー:", error);
      }
    }

    if (!companyInfo) {
      return NextResponse.json(
        { error: "企業情報が見つかりませんでした" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      companyInfo,
      stockData,
      newsData,
      chartData,
      financialData,
      // EDINET DB 拡張フィールド
      edinetCode,
      accountingStandard,
      ratios,
      financialHistory,
    });
  } catch (error) {
    const { createErrorResponse, logError } = await import("@/lib/utils/errorHandler");
    logError(error, "Search API");
    return createErrorResponse(error, "検索中にエラーが発生しました");
  }
}

export const POST = withRateLimit(searchHandler);
