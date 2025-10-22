import { NextRequest, NextResponse } from "next/server";
import { getPerplexityClient } from "@/app/lib/perplexity";
import { checkRateLimit } from "@/app/lib/rateLimiter";

// 株価検索APIエンドポイント - Perplexity APIの活用
export async function POST(request: NextRequest) {
  try {
    // レート制限チェック
    const clientId = request.headers.get("x-forwarded-for") || "anonymous";
    const rateLimit = checkRateLimit(clientId);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Please try again in ${rateLimit.resetIn} seconds`,
          resetIn: rateLimit.resetIn,
        },
        { status: 429 }
      );
    }

    const { query } = await request.json();

    // 入力検証
    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "検索クエリが入力されていません" },
        { status: 400 }
      );
    }

    // Perplexity APIキーの確認
    if (!process.env.PERPLEXITY_API_KEY) {
      return NextResponse.json(
        { error: "Perplexity APIキーが設定されていません" },
        { status: 500 }
      );
    }

    const perplexity = getPerplexityClient();

    // 日本株か米国株かを判定
    const isJapaneseCode = /^\d{4}$/.test(query);
    const isUSSymbol = /^[A-Z]{1,5}$/.test(query);

    // ステップ1: 株価情報と会社情報の取得
    let searchQuery: string;
    if (isJapaneseCode) {
      searchQuery = `日本株の日本株コード${query} の会社名と最新の株価情報を教えてください`;
    } else if (isUSSymbol) {
      searchQuery = `米国株の米国株コード ${query} の会社名と最新の株価情報を教えてください`;
    } else {
      searchQuery = `株価情報・${query}・で検索して、日本株コードまたは米国株コードを教えてください`;
    }

    console.log("Step 1 - Searching with Perplexity:", searchQuery);

    // Perplexity APIで検索
    const searchResponse = await perplexity.search(searchQuery);
    const searchContent = searchResponse.choices[0]?.message?.content || "";
    console.log("Step 1 Response:", searchContent);

    // ステップ2: 株価情報をより詳細に取得
    let priceQuery: string;
    if (isJapaneseCode) {
      priceQuery = `日本株 日本株コード${query} の現在の株価と前日比の変化率を教えてください`;
    } else if (isUSSymbol) {
      priceQuery = `米国株 米国株コード ${query} の現在の株価と前日比の変化率を教えてください`;
    } else {
      priceQuery = `株価情報・${query}・の現在の株価と前日比の変化率を教えてください`;
    }

    console.log("Step 2 - Getting stock price:", priceQuery);

    const priceResponse = await perplexity.search(priceQuery);
    const priceContent = priceResponse.choices[0]?.message?.content || "";
    console.log("Step 2 Response:", priceContent);

    // 株価情報を抽出
    const priceInfo = extractPriceInfo(priceContent);

    // 結果をJSONで返す
    return NextResponse.json({
      success: true,
      results: [
        {
          query: query,
          companyInfo: searchContent,
          priceInfo: priceInfo,
          rawPriceContent: priceContent,
          currency: priceInfo.currency, // 通貨情報
        },
      ],
      rawContent: searchContent,
    });
  } catch (error: unknown) {
    console.error("Stock search error:", error);
    const errorMessage = error instanceof Error ? error.message : "検索処理でエラーが発生しました";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

// 株価情報を抽出する関数
function extractPriceInfo(content: string) {
  const priceInfo: {
    currentPrice: string | null;
    previousClose: string | null;
    change: string | null;
    changePercent: string | null;
    volume: string | null;
    currency: string | null;
  } = {
    currentPrice: null,
    previousClose: null,
    change: null,
    changePercent: null,
    volume: null,
    currency: null, // 通貨情報
  };

  // 通貨判定による株価抽出パターン
  const pricePatterns = [
    { pattern: /\$([\d,]+\.?\d*)/, currency: "USD" },
    { pattern: /([\d,]+\.?\d*)\s*ドル/, currency: "USD" },
    { pattern: /([\d,]+\.?\d*)\s*USD/, currency: "USD" },
    { pattern: /([\d,]+\.?\d*)\s*円/, currency: "JPY" },
    { pattern: /([\d,]+\.?\d*)\s*JPY/, currency: "JPY" },
    { pattern: /¥([\d,]+\.?\d*)/, currency: "JPY" },
    {
      pattern: /現在の?株価\s*[:：]?\s*([\d,]+\.?\d*)\s*ドル/,
      currency: "USD",
    },
    { pattern: /現在の?株価\s*[:：]?\s*([\d,]+\.?\d*)\s*円/, currency: "JPY" },
    { pattern: /現在\s*[:：]?\s*([\d,]+\.?\d*)/, currency: null },
    { pattern: /株価\s*[:：]?\s*([\d,]+\.?\d*)/, currency: null },
  ];

  for (const { pattern, currency } of pricePatterns) {
    const match = content.match(pattern);
    if (match && !priceInfo.currentPrice) {
      priceInfo.currentPrice = match[1].replace(/,/g, "");
      priceInfo.currency = currency;

      // 通貨情報が不明な場合の判定
      if (!currency) {
        if (
          content.includes("ドル") ||
          content.includes("USD") ||
          content.includes("$") ||
          content.includes("米国株")
        ) {
          priceInfo.currency = "USD";
        } else if (
          content.includes("円") ||
          content.includes("JPY") ||
          content.includes("¥") ||
          content.includes("日本株")
        ) {
          priceInfo.currency = "JPY";
        }
      }
      break;
    }
  }

  // 変化率を抽出
  const changePatterns = [
    /([+-]?[\d,]+\.?\d*)\s*\(([+-]?[\d.]+)%\)/,
    /変化率\s*[:：]?\s*([+-]?[\d,]+\.?\d*)/,
    /([+-]?[\d.]+)%/,
  ];

  for (const pattern of changePatterns) {
    const match = content.match(pattern);
    if (match) {
      if (match[1] && match[1].includes("%")) {
        priceInfo.changePercent = match[1].replace("%", "");
      } else if (match[2]) {
        priceInfo.change = match[1].replace(/,/g, "");
        priceInfo.changePercent = match[2];
      } else if (match[1]) {
        priceInfo.change = match[1].replace(/,/g, "");
      }
      break;
    }
  }

  // 出来高を抽出
  const volumePatterns = [
    /出来高\s*[:：]?\s*([\d,]+)/,
    /取引量\s*[:：]?\s*([\d,]+)/,
    /[Vv]olume\s*[:：]?\s*([\d,]+)/,
  ];

  for (const pattern of volumePatterns) {
    const match = content.match(pattern);
    if (match) {
      priceInfo.volume = match[1].replace(/,/g, "");
      break;
    }
  }

  console.log("Extracted price info:", priceInfo);

  // 通貨記号を付けて表示
  if (priceInfo.currentPrice && priceInfo.currency) {
    const formattedPrice = priceInfo.currentPrice;
    priceInfo.currentPrice =
      priceInfo.currency === "USD"
        ? `$${formattedPrice}`
        : `${formattedPrice}円`;
  }
  return priceInfo;
}
