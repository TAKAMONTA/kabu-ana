import { NextRequest, NextResponse } from "next/server";
import { SerpApiClient } from "@/lib/api/serpapi";

export async function POST(request: NextRequest) {
  try {
    const { query, chartPeriod = "1M" } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "検索クエリが必要です" },
        { status: 400 }
      );
    }

    const apiKey = process.env.SERPAPI_API_KEY;

    if (!apiKey || apiKey === "your_serpapi_key_here") {
      return NextResponse.json(
        {
          error:
            "SERPAPI APIキーが設定されていません。.env.localファイルでSERPAPI_API_KEYを設定してください。",
        },
        { status: 400 }
      );
    }

    const serpApi = new SerpApiClient(apiKey);

    // 企業情報を検索
    const companyInfo = await serpApi.searchCompany(query);

    if (!companyInfo) {
      return NextResponse.json(
        { error: "企業情報が見つかりませんでした" },
        { status: 404 }
      );
    }

    // 株価データを取得
    const stockData = await serpApi.getStockData(companyInfo.symbol);

    // 最新ニュースを取得
    const newsData = await serpApi.getCompanyNews(companyInfo.symbol, 5);

    // チャートデータを取得
    const chartData = await serpApi.getChartData(
      companyInfo.symbol,
      chartPeriod
    );

    // 財務データを取得
    const financialData = await serpApi.getFinancialData(companyInfo.symbol);

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
