import { NextRequest, NextResponse } from "next/server";
import { SerpApiClient } from "@/lib/api/serpapi";
import { FMPClient } from "@/lib/api/fmp";
import { FreeNewsClient } from "@/lib/api/freeNews";
import {
  findStocksMentionedInText,
  JPX_STOCK_BY_CODE,
  type JpxStock,
} from "@/lib/jpx/stockMaster";
import { searchSchema } from "@/lib/validation/schemas";
import { withRateLimit } from "@/lib/utils/rateLimiter";
export const dynamic = process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

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

    const serpApiKey = process.env.SERPAPI_API_KEY;
    const fmpApiKey = process.env.FMP_API_KEY;

    // 少なくとも一つのAPIキーが必要
    if (
      (!serpApiKey || serpApiKey === "your_serpapi_key_here") &&
      (!fmpApiKey || fmpApiKey === "your_fmp_api_key_here")
    ) {
      return NextResponse.json(
        {
          error:
            "APIキーが設定されていません。SERPAPI_API_KEYまたはFMP_API_KEYのいずれかを設定してください。",
        },
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
    const shouldSkipSerpFast = Boolean(localJpxStock) || isLikelyPlainUsTicker(query);

    if (localJpxStock && serpApi) {
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
        serpStockData,
        serpNews,
        serpChartData,
        serpFinancialData,
        googleNews,
      ] =
        await measureSearchStep(timings, "jpx.serp_enrichment", () =>
          Promise.all([
            optionalWithTimeout(
              serpApi.getStockData(localJpxStock.code),
              SEARCH_OPTIONAL_TIMEOUT_MS,
              "serp.getStockData.localJpx"
            ),
            optionalWithTimeout(
              serpApi.getCompanyNews(localJpxStock.code, 5),
              NEWS_OPTIONAL_TIMEOUT_MS,
              "serp.getCompanyNews.localJpx"
            ),
            optionalWithTimeout(
              serpApi.getChartData(localJpxStock.code, chartPeriod),
              SEARCH_OPTIONAL_TIMEOUT_MS,
              "serp.getChartData.localJpx"
            ),
            optionalWithTimeout(
              serpApi.getFinancialData(localJpxStock.code),
              SEARCH_OPTIONAL_TIMEOUT_MS,
              "serp.getFinancialData.localJpx"
            ),
            optionalWithTimeout(
              serpApi.getCompanyNewsFromGoogle(
                localJpxStock.code,
                localJpxStock.name,
                5
              ),
              NEWS_OPTIONAL_TIMEOUT_MS,
              "serp.getCompanyNewsFromGoogle.localJpx"
            ),
          ])
        );

      if (serpStockData) {
        stockData = serpStockData;
        companyInfo = {
          ...companyInfo,
          price: serpStockData.price,
          change: serpStockData.change,
          changePercent: serpStockData.changePercent,
        };
      }
      if (Array.isArray(serpNews) && serpNews.length > 0) {
        newsData = serpNews;
      } else if (Array.isArray(googleNews) && googleNews.length > 0) {
        newsData = googleNews;
      }
      if (Array.isArray(serpChartData) && serpChartData.length > 0) {
        chartData = serpChartData;
      }
      financialData = financialData || serpFinancialData;
    }

    // 最初にGoogle Finance系の高速結果を取りに行く。体感速度を優先し、詳細データは後段で補う。
    if (serpApi && !shouldSkipSerpFast) {
      try {
        const fastResult = await measureSearchStep(
          timings,
          "serp.fast_search",
          () => serpApi.getFastSearchResult(query, chartPeriod)
        );

        if (fastResult) {
          dataSource = "serp_fast";
          companyInfo = fastResult.companyInfo;
          stockData = fastResult.stockData;
          newsData = fastResult.newsData;
          chartData = fastResult.chartData;
          financialData = fastResult.financialData;
        }
      } catch (error) {
        console.error("SERPAPI 高速検索エラー:", error);
      }
    }

    // 高速検索で見つからなかった場合だけ、従来のSERPAPIフォールバックを短い待ち時間で実行する。
    if (serpApi && (!companyInfo || !stockData)) {
      try {
        const serpCompanyInfo = await measureSearchStep(
          timings,
          "serp.company_lookup",
          async () => {
            const [financeLookup, googleLookup] = await Promise.all([
              optionalWithTimeout(
              serpApi.searchCompany(query),
              SEARCH_OPTIONAL_TIMEOUT_MS,
              "serp.searchCompany"
              ),
              optionalWithTimeout(
                serpApi.searchCompanyByGoogle(query),
                SEARCH_OPTIONAL_TIMEOUT_MS,
                "serp.searchCompanyByGoogle"
              ),
            ]);
            return financeLookup || googleLookup;
          }
        );

        if (serpCompanyInfo) {
          dataSource = "serp_fallback";
          companyInfo = companyInfo || serpCompanyInfo;

          const [serpStockData, serpNews, serpChartData, serpFinancialData] =
            await Promise.all([
              stockData
                ? Promise.resolve(stockData)
                : optionalWithTimeout(
                    serpApi.getStockData(serpCompanyInfo.symbol),
                    SEARCH_OPTIONAL_TIMEOUT_MS,
                    "serp.getStockData"
                  ),
              newsData.length > 0
                ? Promise.resolve(newsData)
                : optionalWithTimeout(
                    serpApi.getCompanyNews(serpCompanyInfo.symbol, 5),
                    NEWS_OPTIONAL_TIMEOUT_MS,
                    "serp.getCompanyNews"
                  ),
              chartData.length > 0
                ? Promise.resolve(chartData)
                : optionalWithTimeout(
                    serpApi.getChartData(serpCompanyInfo.symbol, chartPeriod),
                    SEARCH_OPTIONAL_TIMEOUT_MS,
                    "serp.getChartData"
                  ),
              financialData
                ? Promise.resolve(financialData)
                : optionalWithTimeout(
                    serpApi.getFinancialData(serpCompanyInfo.symbol),
                    SEARCH_OPTIONAL_TIMEOUT_MS,
                    "serp.getFinancialData"
                  ),
            ]);

          stockData = stockData || serpStockData;
          if (Array.isArray(serpNews) && serpNews.length > 0) {
            newsData = serpNews;
          }
          if (Array.isArray(serpChartData) && serpChartData.length > 0) {
            chartData = serpChartData;
          }
          financialData = financialData || serpFinancialData;

          if (newsData.length === 0) {
            const googleNews = await optionalWithTimeout(
              serpApi.getCompanyNewsFromGoogle(
                serpCompanyInfo.symbol,
                serpCompanyInfo.name,
                5
              ),
              NEWS_OPTIONAL_TIMEOUT_MS,
              "serp.getCompanyNewsFromGoogle"
            );
            if (Array.isArray(googleNews) && googleNews.length > 0) {
              newsData = googleNews;
            }
          }
        }
      } catch (error) {
        console.error("SERPAPI フォールバックエラー:", error);
      }
    }

    // SERPAPIで必要最低限が取れない場合だけFMPを使う。低優先データは短い制限時間で補完する。
    if (fmpApi && (!companyInfo || !stockData)) {
      try {
        const searchResults =
          (await measureSearchStep(timings, "fmp.comprehensive_search", () =>
            optionalWithTimeout(
              fmpApi.comprehensiveSearch(query),
              SEARCH_OPTIONAL_TIMEOUT_MS,
              "fmp.comprehensiveSearch"
            )
          )) || [];

        if (searchResults && searchResults.length > 0) {
          const company = searchResults[0];

          const [profile, quote] = await Promise.all([
            optionalWithTimeout(
              fmpApi.getCompanyProfile(company.symbol),
              SEARCH_OPTIONAL_TIMEOUT_MS,
              "fmp.getCompanyProfile"
            ),
            optionalWithTimeout(
              fmpApi.getQuote(company.symbol),
              SEARCH_OPTIONAL_TIMEOUT_MS,
              "fmp.getQuote"
            ),
          ]);

          if (profile) {
            dataSource = "fmp";
            companyInfo = {
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
          } else if (!companyInfo) {
            dataSource = "fmp";
            companyInfo = {
              name: company.companyName || company.name || company.symbol,
              symbol: company.symbol,
              market: company.exchangeShortName || company.exchange || "",
            };
          }

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
              dividend: 0, // FMPでは別途取得が必要
              high52: quote.yearHigh,
              low52: quote.yearLow,
            };
          } else if (profile) {
            stockData = {
              symbol: profile.symbol,
              price: profile.price || 0,
              change: profile.changes || 0,
              changePercent:
                profile.price > 0 ? (profile.changes / profile.price) * 100 : 0,
              volume: profile.volAvg || 0,
              marketCap: profile.mktCap ? profile.mktCap.toString() : "N/A",
              pe: 0,
              eps: 0,
              dividend: profile.lastDiv || 0,
              high52: 0,
              low52: 0,
            };
          }

          const [financialStatements, keyMetrics, freeNews] = await Promise.all([
            optionalWithTimeout(
              fmpApi.getFinancialStatements(company.symbol, 1),
              SEARCH_OPTIONAL_TIMEOUT_MS,
              "fmp.getFinancialStatements"
            ),
            optionalWithTimeout(
              fmpApi.getKeyMetrics(company.symbol, 1),
              SEARCH_OPTIONAL_TIMEOUT_MS,
              "fmp.getKeyMetrics"
            ),
            optionalWithTimeout(
              new FreeNewsClient().getComprehensiveNews(
                company.name || company.companyName || company.symbol,
                company.symbol,
                5
              ),
              NEWS_OPTIONAL_TIMEOUT_MS,
              "freeNews.getComprehensiveNews"
            ),
          ]);

          if (financialStatements && financialStatements.length > 0) {
            const latest = financialStatements[0];
            financialData = {
              revenue: latest.revenue?.toString(),
              netIncome: latest.netIncome?.toString(),
              operatingIncome: latest.operatingIncome?.toString(),
              totalAssets: undefined,
              cash: undefined,
              eps: latest.eps?.toString(),
              period: `${latest.calendarYear} (${latest.period})`,
            };
          }

          if (keyMetrics && keyMetrics.length > 0) {
            const metrics = keyMetrics[0];
            if (stockData) {
              stockData.dividend = metrics.dividendYield || 0;
            }
          }

          if (freeNews && freeNews.length > 0) {
            newsData = freeNews;
          }
        }
      } catch (error) {
        console.error("FMP API エラー:", error);
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
      metadata: {
        dataSource,
        timings,
      },
    });
  } catch (error) {
    // セキュアなエラーハンドリング
    const { createErrorResponse, logError } = await import(
      "@/lib/utils/errorHandler"
    );
    logError(error, "Search API");
    return createErrorResponse(error, "検索中にエラーが発生しました");
  }
}

export const POST = withRateLimit(searchHandler);
