import { NextRequest, NextResponse } from "next/server";
import { createMarketDataClient } from "@/lib/api/marketDataClient";
import { FreeNewsClient } from "@/lib/api/freeNews";
import {
  findStocksMentionedInText,
  JPX_STOCK_BY_CODE,
  type JpxStock,
} from "@/lib/jpx/stockMaster";
import {
  EdinetDBClient,
  getEdinetSearchQueryFromSymbol,
} from "@/lib/api/edinetdb";
import { searchSchema } from "@/lib/validation/schemas";
import { withRateLimit } from "@/lib/utils/rateLimiter";
export const dynamic =
  process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

const SEARCH_OPTIONAL_TIMEOUT_MS = 2200;
const NEWS_OPTIONAL_TIMEOUT_MS = 1800;

async function measureSearchStep<T>(
  timings: Record<string, number>,
  label: string,
  task: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  try {
    return await task();
  } finally {
    timings[label] = Date.now() - startedAt;
  }
}

function optionalWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T | null> {
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      console.warn(`Search API optional step timed out: ${label}`);
      resolve(null);
    }, timeoutMs);

    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(error => {
        clearTimeout(timer);
        console.warn(
          `Search API optional step failed: ${label}`,
          error instanceof Error ? error.message : error
        );
        resolve(null);
      });
  });
}

function findLocalJpxStock(query: string): JpxStock | null {
  const normalized = query.normalize("NFKC").trim();
  const code = normalized.match(/\b\d{4}\b/)?.[0];
  if (code) return JPX_STOCK_BY_CODE.get(code) || null;
  return findStocksMentionedInText(normalized, 1)[0] || null;
}

function isLikelyPlainUsTicker(query: string): boolean {
  return /^[A-Z][A-Z.]{0,5}$/i.test(query.trim());
}

async function searchHandler(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }
  try {
    // 入力データの検証
    const body = await request.json();
    const validationResult = searchSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "入力データが無効です",
          details: validationResult.error.errors.map(err => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    const { query, chartPeriod } = validationResult.data;

    const marketApi = createMarketDataClient();

    // データ取得の結果を格納する変数
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
      keyEvent?: {
        title: string;
        link: string;
        source: string;
      };
    }> = [];
    let financialData: {
      revenue?: string;
      netIncome?: string;
      operatingIncome?: string;
      totalAssets?: string;
      cash?: string;
      eps?: string;
      period?: string;
    } | null = null;

    const timings: Record<string, number> = {};
    const requestStartedAt = Date.now();
    let dataSource = "none";
    const localJpxStock = findLocalJpxStock(query);
    const shouldSkipFastSearch =
      Boolean(localJpxStock) || isLikelyPlainUsTicker(query);

    if (localJpxStock) {
      companyInfo = {
        name: localJpxStock.name,
        symbol: localJpxStock.code,
        market: "TYO",
        description: `${localJpxStock.marketSegment} / ${localJpxStock.sector33}`,
      };
      stockData = {
        symbol: localJpxStock.code,
        price: 0,
        change: 0,
        changePercent: 0,
        volume: 0,
        marketCap: "N/A",
        pe: 0,
        eps: 0,
        dividend: 0,
        high52: 0,
        low52: 0,
      };
      dataSource = "jpx_local";

      const [
        marketStockData,
        marketNews,
        marketChartData,
        marketFinancialData,
        googleNews,
      ] = await measureSearchStep(timings, "jpx.market_enrichment", () =>
        Promise.all([
          optionalWithTimeout(
            marketApi.getStockData(localJpxStock.code),
            SEARCH_OPTIONAL_TIMEOUT_MS,
            "market.getStockData.localJpx"
          ),
          optionalWithTimeout(
            marketApi.getCompanyNews(localJpxStock.code, 5),
            NEWS_OPTIONAL_TIMEOUT_MS,
            "market.getCompanyNews.localJpx"
          ),
          optionalWithTimeout(
            marketApi.getChartData(localJpxStock.code, chartPeriod),
            SEARCH_OPTIONAL_TIMEOUT_MS,
            "market.getChartData.localJpx"
          ),
          optionalWithTimeout(
            marketApi.getFinancialData(localJpxStock.code),
            SEARCH_OPTIONAL_TIMEOUT_MS,
            "market.getFinancialData.localJpx"
          ),
          optionalWithTimeout(
            marketApi.getCompanyNewsFromGoogle(
              localJpxStock.code,
              localJpxStock.name,
              5
            ),
            NEWS_OPTIONAL_TIMEOUT_MS,
            "market.getCompanyNewsFromGoogle.localJpx"
          ),
        ])
      );

      if (marketStockData) {
        stockData = marketStockData;
        companyInfo = {
          ...companyInfo,
          price: marketStockData.price,
          change: marketStockData.change,
          changePercent: marketStockData.changePercent,
        };
      }
      if (Array.isArray(marketNews) && marketNews.length > 0) {
        newsData = marketNews;
      } else if (Array.isArray(googleNews) && googleNews.length > 0) {
        newsData = googleNews;
      }
      if (Array.isArray(marketChartData) && marketChartData.length > 0) {
        chartData = marketChartData;
      }
      financialData = financialData || marketFinancialData;
    }

    // 最初にGoogle Finance系の高速結果を取りに行く。体感速度を優先し、詳細データは後段で補う。
    if (!shouldSkipFastSearch) {
      try {
        const fastResult = await measureSearchStep(
          timings,
          "market.fast_search",
          () => marketApi.getFastSearchResult(query, chartPeriod)
        );

        if (fastResult) {
          dataSource = "market_fast";
          companyInfo = fastResult.companyInfo;
          stockData = fastResult.stockData;
          newsData = fastResult.newsData;
          chartData = fastResult.chartData;
          financialData = fastResult.financialData;
        }
      } catch (error) {
        console.error("MarketData 高速検索エラー:", error);
      }
    }

    // 高速検索で見つからなかった場合だけ、市場データAPIのフォールバックを短い待ち時間で実行する。
    if (!companyInfo || !stockData) {
      try {
        const marketCompanyInfo = await measureSearchStep(
          timings,
          "market.company_lookup",
          async () => {
            const [financeLookup, googleLookup] = await Promise.all([
              optionalWithTimeout(
                marketApi.searchCompany(query),
                SEARCH_OPTIONAL_TIMEOUT_MS,
                "market.searchCompany"
              ),
              optionalWithTimeout(
                marketApi.searchCompanyByGoogle(query),
                SEARCH_OPTIONAL_TIMEOUT_MS,
                "market.searchCompanyByGoogle"
              ),
            ]);
            return financeLookup || googleLookup;
          }
        );

        if (marketCompanyInfo) {
          dataSource = "market_fallback";
          companyInfo = companyInfo || marketCompanyInfo;

          const [
            marketStockData,
            marketNews,
            marketChartData,
            marketFinancialData,
          ] = await Promise.all([
            stockData
              ? Promise.resolve(stockData)
              : optionalWithTimeout(
                  marketApi.getStockData(marketCompanyInfo.symbol),
                  SEARCH_OPTIONAL_TIMEOUT_MS,
                  "market.getStockData"
                ),
            newsData.length > 0
              ? Promise.resolve(newsData)
              : optionalWithTimeout(
                  marketApi.getCompanyNews(marketCompanyInfo.symbol, 5),
                  NEWS_OPTIONAL_TIMEOUT_MS,
                  "market.getCompanyNews"
                ),
            chartData.length > 0
              ? Promise.resolve(chartData)
              : optionalWithTimeout(
                  marketApi.getChartData(marketCompanyInfo.symbol, chartPeriod),
                  SEARCH_OPTIONAL_TIMEOUT_MS,
                  "market.getChartData"
                ),
            financialData
              ? Promise.resolve(financialData)
              : optionalWithTimeout(
                  marketApi.getFinancialData(marketCompanyInfo.symbol),
                  SEARCH_OPTIONAL_TIMEOUT_MS,
                  "market.getFinancialData"
                ),
          ]);

          stockData = stockData || marketStockData;
          if (Array.isArray(marketNews) && marketNews.length > 0) {
            newsData = marketNews;
          }
          if (Array.isArray(marketChartData) && marketChartData.length > 0) {
            chartData = marketChartData;
          }
          financialData = financialData || marketFinancialData;

          if (newsData.length === 0) {
            const googleNews = await optionalWithTimeout(
              marketApi.getCompanyNewsFromGoogle(
                marketCompanyInfo.symbol,
                marketCompanyInfo.name,
                5
              ),
              NEWS_OPTIONAL_TIMEOUT_MS,
              "market.getCompanyNewsFromGoogle"
            );
            if (Array.isArray(googleNews) && googleNews.length > 0) {
              newsData = googleNews;
            }
          }
        }
      } catch (error) {
        console.error("MarketData フォールバックエラー:", error);
      }
    }

    if (!companyInfo) {
      return NextResponse.json(
        { error: "企業情報が見つかりませんでした" },
        { status: 404 }
      );
    }

    if (!stockData) {
      stockData = {
        symbol: companyInfo.symbol,
        price: companyInfo.price || 0,
        change: companyInfo.change || 0,
        changePercent: companyInfo.changePercent || 0,
        volume: 0,
        marketCap: "N/A",
        pe: 0,
        eps: 0,
        dividend: 0,
        high52: 0,
        low52: 0,
      };
    }

    if (stockData.price === 0 && chartData.length > 0) {
      const latestChartPoint = [...chartData]
        .reverse()
        .find(point => Number(point.price) > 0);
      if (latestChartPoint) {
        stockData = {
          ...stockData,
          price: latestChartPoint.price,
          volume: stockData.volume || latestChartPoint.volume || 0,
        };
        companyInfo = {
          ...companyInfo,
          price: companyInfo.price || latestChartPoint.price,
        };
      }
    }

    // EDINET DB エンリッチメント（日本株かつ EDINETDB_API_KEY 設定時のみ）
    let edinetCode: string | null = null;
    let accountingStandard: string | null = null;
    let ratios: Record<string, number | undefined> | null = null;
    let financialHistory: Array<{
      fiscalYear: number;
      revenue?: number;
      operatingIncome?: number;
      netIncome?: number;
      eps?: number;
      totalAssets?: number;
      cfOperating?: number;
    }> | null = null;

    const edinetDbKey = process.env.EDINETDB_API_KEY;
    const edinetSearchQuery = getEdinetSearchQueryFromSymbol(
      companyInfo?.symbol,
      companyInfo?.market
    );

    if (
      edinetDbKey &&
      edinetDbKey !== "your_edinetdb_api_key_here" &&
      edinetSearchQuery
    ) {
      try {
        const edinetApi = new EdinetDBClient(edinetDbKey);
        const edinetResults = await Promise.race([
          edinetApi.searchCompanies(edinetSearchQuery, 3),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("EDINET timeout")), 2000)
          ),
        ]).catch(
          () => [] as Awaited<ReturnType<EdinetDBClient["searchCompanies"]>>
        );

        if (Array.isArray(edinetResults) && edinetResults.length > 0) {
          const company = edinetResults[0];
          edinetCode = company.edinet_code;

          const [detail, financialsData, ratiosData] = await Promise.allSettled(
            [
              edinetApi.getCompany(company.edinet_code),
              edinetApi.getFinancials(company.edinet_code),
              edinetApi.getRatios(company.edinet_code),
            ]
          );

          if (detail.status === "fulfilled" && detail.value) {
            accountingStandard = detail.value.accounting_standard ?? null;
          }

          if (
            financialsData.status === "fulfilled" &&
            financialsData.value.length > 0
          ) {
            const sorted = [...financialsData.value]
              .sort((a, b) => b.fiscal_year - a.fiscal_year)
              .slice(0, 6);
            financialHistory = sorted.map(f => ({
              fiscalYear: f.fiscal_year,
              revenue: f.revenue ?? undefined,
              operatingIncome: f.operating_income ?? undefined,
              netIncome: f.net_income ?? undefined,
              eps: f.eps ?? undefined,
              totalAssets: f.total_assets ?? undefined,
              cfOperating: f.cf_operating ?? undefined,
            }));
          }

          if (ratiosData.status === "fulfilled" && ratiosData.value) {
            const r = ratiosData.value;
            ratios = {
              roe: r.roe ?? undefined,
              roa: r.roa ?? undefined,
              operatingMargin: r.operating_margin ?? undefined,
              netMargin: r.net_margin ?? undefined,
              grossMargin: r.gross_margin ?? undefined,
              equityRatio: r.equity_ratio ?? undefined,
              currentRatio: r.current_ratio ?? undefined,
              deRatio: r.de_ratio ?? undefined,
              fcf: r.fcf ?? undefined,
              ebitda: r.ebitda ?? undefined,
              revenueGrowth: r.revenue_growth ?? undefined,
              niGrowth: r.ni_growth ?? undefined,
              revenueCagr3y: r.revenue_cagr_3y ?? undefined,
              niCagr3y: r.ni_cagr_3y ?? undefined,
              dividendYield: r.dividend_yield ?? undefined,
            };
          }
        }
      } catch (edinetError) {
        console.error("EDINET DB エンリッチメントエラー:", edinetError);
      }
    }

    timings.total = Date.now() - requestStartedAt;
    console.info("Search API timings", {
      query,
      dataSource,
      timings,
      hasChart: chartData.length > 0,
      newsCount: newsData.length,
      hasFinancialData: Boolean(financialData),
    });

    return NextResponse.json({
      companyInfo,
      stockData,
      newsData,
      chartData,
      financialData,
      ...(edinetCode
        ? { edinetCode, accountingStandard, ratios, financialHistory }
        : {}),
      metadata: {
        dataSource,
        timings,
      },
    });
  } catch (error) {
    // セキュアなエラーハンドリング
    const { createErrorResponse, logError } =
      await import("@/lib/utils/errorHandler");
    logError(error, "Search API");
    return createErrorResponse(error, "検索中にエラーが発生しました");
  }
}

export const POST = withRateLimit(searchHandler);
