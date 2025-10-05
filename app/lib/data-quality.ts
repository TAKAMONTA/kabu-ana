/**
 * データ品質チェック機能
 * データの欠損率を評価し、分析に十分なデータがあるかを判定
 */

// 株価データの型定義
interface StockPriceChange {
  パーセント?: number | null;
  円?: number | null;
  ドル?: number | null;
}

interface StockPriceInfo {
  現在値?: number | null;
  前日比?: StockPriceChange;
  出来高?: number | null;
  始値?: number | null;
  高値?: number | null;
  安値?: number | null;
  時価総額?: string | null;
  情報源?: string;
}

interface TechnicalIndicators {
  MA25?: number | null;
  MA75?: number | null;
  MA200?: number | null;
  RSI?: number | null;
  MACD?: {
    値?: number | null;
    シグナル?: number | null;
    ヒストグラム?: number | null;
  };
  情報源?: string;
}

interface FinancialMetrics {
  PER?: number | null;
  PBR?: number | null;
  ROE?: number | null;
  配当利回り?: number | null;
  直近決算?: string | null;
  EPS?: number | null;
  情報源?: string;
}

interface NewsItem {
  タイトル?: string;
  要約?: string;
  日時?: string;
  URL?: string;
  信頼度?: "高" | "中" | "低";
}

interface StockData {
  株価情報?: StockPriceInfo;
  テクニカル指標?: TechnicalIndicators;
  財務指標?: FinancialMetrics;
  最新ニュース?: NewsItem[];
  [key: string]: unknown;
}

export interface DataQualityResult {
  score: number; // 0-100のスコア
  isAdequate: boolean; // 分析に十分なデータがあるか
  missingFields: string[]; // 欠損しているフィールド
  availableFields: string[]; // 取得できたフィールド
  technicalDataAvailable: boolean; // テクニカル指標が利用可能か
  fundamentalDataAvailable: boolean; // 財務指標が利用可能か
  details: {
    stockPriceComplete: boolean; // 株価情報が完全か
    technicalIndicatorsRate: number; // テクニカル指標の取得率(%)
    financialMetricsRate: number; // 財務指標の取得率(%)
    newsAvailable: boolean; // ニュースが利用可能か
  };
}

export function assessDataQuality(
  data: Record<string, unknown>
): DataQualityResult {
  const missingFields: string[] = [];
  const availableFields: string[] = [];

  // dataをStockData型として扱う
  const stockData = data as StockData;

  // 株価情報のチェック
  let stockPriceComplete = true;
  const requiredStockFields = ["現在値", "前日比", "出来高"];
  for (const field of requiredStockFields) {
    if (field === "前日比") {
      const changePercent = stockData?.株価情報?.前日比?.パーセント;
      if (changePercent === undefined || changePercent === null) {
        missingFields.push(`株価情報.前日比.パーセント`);
        stockPriceComplete = false;
      } else {
        availableFields.push(`株価情報.前日比`);
      }
    } else {
      const fieldValue = stockData?.株価情報?.[field as keyof StockPriceInfo];
      if (fieldValue === undefined || fieldValue === null) {
        missingFields.push(`株価情報.${field}`);
        stockPriceComplete = false;
      } else {
        availableFields.push(`株価情報.${field}`);
      }
    }
  }

  // テクニカル指標のチェック
  const technicalFields = ["MA25", "MA75", "MA200", "RSI", "MACD"];
  let technicalAvailable = 0;
  for (const field of technicalFields) {
    if (field === "MACD") {
      const macdValue = stockData?.テクニカル指標?.MACD?.値;
      if (macdValue !== undefined && macdValue !== null) {
        technicalAvailable++;
        availableFields.push(`テクニカル指標.MACD`);
      } else {
        missingFields.push(`テクニカル指標.MACD`);
      }
    } else {
      const fieldValue =
        stockData?.テクニカル指標?.[field as keyof TechnicalIndicators];
      if (fieldValue !== undefined && fieldValue !== null) {
        technicalAvailable++;
        availableFields.push(`テクニカル指標.${field}`);
      } else {
        missingFields.push(`テクニカル指標.${field}`);
      }
    }
  }
  const technicalIndicatorsRate =
    (technicalAvailable / technicalFields.length) * 100;

  // 財務指標のチェック
  const financialFields = ["PER", "PBR", "ROE", "配当利回り"];
  let financialAvailable = 0;
  for (const field of financialFields) {
    const fieldValue = stockData?.財務指標?.[field as keyof FinancialMetrics];
    if (fieldValue !== undefined && fieldValue !== null) {
      financialAvailable++;
      availableFields.push(`財務指標.${field}`);
    } else {
      missingFields.push(`財務指標.${field}`);
    }
  }
  const financialMetricsRate =
    (financialAvailable / financialFields.length) * 100;

  // ニュースのチェック
  const newsAvailable =
    Array.isArray(stockData?.最新ニュース) && stockData.最新ニュース.length > 0;
  if (newsAvailable) {
    availableFields.push("最新ニュース");
  } else {
    missingFields.push("最新ニュース");
  }

  // スコア計算
  let score = 0;
  // 株価情報: 50点（最重要）
  if (stockPriceComplete) {
    score += 50;
  } else {
    const currentPrice = stockData?.株価情報?.現在値;
    if (currentPrice !== undefined && currentPrice !== null) {
      score += 25; // 現在値だけでもあれば半分
    }
  }

  // テクニカル指標: 25点
  score += (technicalIndicatorsRate / 100) * 25;

  // 財務指標: 20点
  score += (financialMetricsRate / 100) * 20;

  // ニュース: 5点
  if (newsAvailable) {
    score += 5;
  }

  // 分析に十分なデータがあるかの判定
  // 株価情報が完全で、かつテクニカルか財務のどちらかが50%以上あれば十分
  const isAdequate =
    stockPriceComplete &&
    (technicalIndicatorsRate >= 50 || financialMetricsRate >= 50);

  return {
    score: Math.round(score),
    isAdequate,
    missingFields,
    availableFields,
    technicalDataAvailable: technicalIndicatorsRate >= 40,
    fundamentalDataAvailable: financialMetricsRate >= 40,
    details: {
      stockPriceComplete,
      technicalIndicatorsRate: Math.round(technicalIndicatorsRate),
      financialMetricsRate: Math.round(financialMetricsRate),
      newsAvailable,
    },
  };
}

/**
 * データ品質レポートを生成
 */
export function generateDataQualityReport(quality: DataQualityResult): string {
  let report = `【データ品質評価】\n`;
  report += `総合スコア: ${quality.score}/100\n`;
  report += `分析可否: ${quality.isAdequate ? "✅ 分析可能" : "⚠️ データ不足"}\n\n`;

  report += `【詳細】\n`;
  report += `株価情報: ${quality.details.stockPriceComplete ? "✅ 完全" : "❌ 不完全"}\n`;
  report += `テクニカル指標: ${quality.details.technicalIndicatorsRate}% 取得\n`;
  report += `財務指標: ${quality.details.financialMetricsRate}% 取得\n`;
  report += `ニュース: ${quality.details.newsAvailable ? "✅ あり" : "❌ なし"}\n\n`;

  if (quality.missingFields.length > 0) {
    report += `【欠損フィールド】\n`;
    quality.missingFields.slice(0, 10).forEach(field => {
      report += `- ${field}\n`;
    });
    if (quality.missingFields.length > 10) {
      report += `...他${quality.missingFields.length - 10}件\n`;
    }
  }

  return report;
}
