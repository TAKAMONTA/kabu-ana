import { NextRequest, NextResponse } from "next/server";
import { SerpApiClient } from "@/lib/api/serpapi";
import { FMPClient } from "@/lib/api/fmp";

export async function POST(request: NextRequest) {
  try {
    const { query, chartPeriod = "1M" } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "検索クエリが必要です" },
        { status: 400 }
      );
    }

    const serpApiKey = process.env.SERPAPI_API_KEY;
    const fmpApiKey = process.env.FMP_API_KEY;

    // 少なくとも一つのAPIキーが必要
    if ((!serpApiKey || serpApiKey === "your_serpapi_key_here") && 
        (!fmpApiKey || fmpApiKey === "your_fmp_api_key_here")) {
      return NextResponse.json(
        {
          error:
            "APIキーが設定されていません。SERPAPI_API_KEYまたはFMP_API_KEYのいずれかを設定してください。",
        },
        { status: 400 }
      );
    }

    const serpApi = serpApiKey && serpApiKey !== "your_serpapi_key_here" 
      ? new SerpApiClient(serpApiKey) 
      : null;
    const fmpApi = fmpApiKey && fmpApiKey !== "your_fmp_api_key_here" 
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
        
        // 企業検索
        const searchResults = await fmpApi.searchCompany(query);
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
          const financialStatements = await fmpApi.getFinancialStatements(company.symbol, 1);
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
          
          const serpStockData = await serpApi.getStockData(serpCompanyInfo.symbol);
          stockData = stockData || serpStockData;
          
          newsData = await serpApi.getCompanyNews(serpCompanyInfo.symbol, 5);
          chartData = await serpApi.getChartData(serpCompanyInfo.symbol, chartPeriod);
          financialData = financialData || await serpApi.getFinancialData(serpCompanyInfo.symbol);
          
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
    console.error("検索エラー:", error);
    return NextResponse.json(
      { error: "検索中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
