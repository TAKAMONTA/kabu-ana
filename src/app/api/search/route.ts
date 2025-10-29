import { NextRequest, NextResponse } from "next/server";
import { SerpApiClient } from "@/lib/api/serpapi";
import { FMPClient } from "@/lib/api/fmp";
import { FreeNewsClient } from "@/lib/api/freeNews";
import { searchSchema } from "@/lib/validation/schemas";
import { withRateLimit } from "@/lib/utils/rateLimiter";

async function searchHandler(request: NextRequest) {
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

    // FMP APIを使用してデータを取得（優先）
    if (fmpApi) {
      try {
        // 統合検索を実行
        const searchResults = await fmpApi.comprehensiveSearch(query);
        if (searchResults && searchResults.length > 0) {
          const company = searchResults[0];

          // 企業プロファイルを取得
          const profile = await fmpApi.getCompanyProfile(company.symbol);
          if (profile) {
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
          }

          // 株価データを取得
          const quote = await fmpApi.getQuote(company.symbol);
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
          }

          // 財務諸表を取得
          const financialStatements = await fmpApi.getFinancialStatements(
            company.symbol,
            1
          );
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

          // 主要指標を取得
          const keyMetrics = await fmpApi.getKeyMetrics(company.symbol, 1);
          if (keyMetrics && keyMetrics.length > 0) {
            const metrics = keyMetrics[0];
            if (stockData) {
              stockData.dividend = metrics.dividendYield || 0;
            }
          }

          // ニュースを取得（無料の代替手段を使用）
          const freeNewsClient = new FreeNewsClient();
          const freeNews = await freeNewsClient.getComprehensiveNews(
            company.name || company.companyName,
            company.symbol,
            5
          );
          if (freeNews && freeNews.length > 0) {
            newsData = freeNews;
          }
        }
      } catch (error) {
        console.error("FMP API エラー:", error);
      }
    }

    // SERPAPIをフォールバックとして使用
    if (serpApi && (!companyInfo || !stockData)) {
      try {
        const serpCompanyInfo = await serpApi.searchCompany(query);
        if (serpCompanyInfo) {
          companyInfo = companyInfo || serpCompanyInfo;

          const serpStockData = await serpApi.getStockData(
            serpCompanyInfo.symbol
          );
          stockData = stockData || serpStockData;

          // SERPAPIからニュースを取得
          const serpNews = await serpApi.getCompanyNews(
            serpCompanyInfo.symbol,
            5
          );
          if (serpNews && serpNews.length > 0) {
            newsData = serpNews;
          } else {
            // Google検索からもニュースを取得
            const googleNews = await serpApi.getCompanyNewsFromGoogle(
              serpCompanyInfo.symbol,
              serpCompanyInfo.name,
              5
            );
            if (googleNews && googleNews.length > 0) {
              newsData = googleNews;
            }
          }
          chartData = await serpApi.getChartData(
            serpCompanyInfo.symbol,
            chartPeriod
          );
          financialData =
            financialData ||
            (await serpApi.getFinancialData(serpCompanyInfo.symbol));
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
