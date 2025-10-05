import { StockData, CollectorResult } from "./types";

export class DataValidator {
  private readonly requiredFields = [
    "metadata.証券コード",
    "metadata.企業名",
    "株価情報.現在値",
    "株価情報.前日比.パーセント",
  ];

  validateStockData(data: Partial<StockData>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    score: number; // 0-100
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // 必須フィールドのチェック
    for (const field of this.requiredFields) {
      const value = this.getNestedValue(data, field);
      if (value === null || value === undefined || value === "") {
        errors.push(`必須フィールドが不足: ${field}`);
        score -= 20;
      }
    }

    // 株価情報の妥当性チェック
    if (data.株価情報?.現在値 !== null && data.株価情報?.現在値 !== undefined) {
      if (data.株価情報.現在値 <= 0) {
        errors.push("株価が無効な値です（0以下）");
        score -= 30;
      }
    }

    // 前日比の妥当性チェック
    if (
      data.株価情報?.前日比?.パーセント !== null &&
      data.株価情報?.前日比?.パーセント !== undefined
    ) {
      const changePercent = data.株価情報.前日比.パーセント;
      if (Math.abs(changePercent) > 50) {
        warnings.push("前日比が異常に大きい値です（50%超）");
        score -= 10;
      }
    }

    // 出来高の妥当性チェック
    if (data.株価情報?.出来高 !== null && data.株価情報?.出来高 !== undefined) {
      if (data.株価情報.出来高 < 0) {
        errors.push("出来高が負の値です");
        score -= 15;
      }
    }

    // 財務指標の妥当性チェック
    if (data.財務指標) {
      const { PER, PBR, ROE } = data.財務指標;

      if (PER !== null && PER !== undefined) {
        if (PER < 0 || PER > 1000) {
          warnings.push("PER値が異常な範囲です");
          score -= 5;
        }
      }

      if (PBR !== null && PBR !== undefined) {
        if (PBR < 0 || PBR > 50) {
          warnings.push("PBR値が異常な範囲です");
          score -= 5;
        }
      }

      if (ROE !== null && ROE !== undefined) {
        if (ROE < -100 || ROE > 100) {
          warnings.push("ROE値が異常な範囲です");
          score -= 5;
        }
      }
    }

    // テクニカル指標の妥当性チェック
    if (data.テクニカル指標) {
      const { RSI } = data.テクニカル指標;

      if (RSI !== null && RSI !== undefined) {
        if (RSI < 0 || RSI > 100) {
          warnings.push("RSI値が異常な範囲です（0-100の範囲外）");
          score -= 5;
        }
      }
    }

    // ニュースの妥当性チェック
    if (data.最新ニュース && data.最新ニュース.length > 0) {
      for (const news of data.最新ニュース) {
        if (!news.タイトル || news.タイトル.length < 5) {
          warnings.push("ニュースタイトルが短すぎます");
          score -= 2;
        }

        if (!news.日時 || !this.isValidISODate(news.日時)) {
          warnings.push("ニュースの日時が無効です");
          score -= 3;
        }
      }
    }

    // 信頼度スコアの調整
    if (data.metadata?.データ信頼度) {
      switch (data.metadata.データ信頼度) {
        case "高":
          score += 5;
          break;
        case "中":
          score += 0;
          break;
        case "低":
          score -= 10;
          break;
      }
    }

    // スコアを0-100の範囲に調整
    score = Math.max(0, Math.min(100, score));

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score,
    };
  }

  validateCollectorResult(result: CollectorResult): {
    isValid: boolean;
    quality: "高" | "中" | "低";
    recommendations: string[];
  } {
    const dataValidation = this.validateStockData(result.data);

    let quality: "高" | "中" | "低" = "低";
    const recommendations: string[] = [];

    if (dataValidation.score >= 80) {
      quality = "高";
    } else if (dataValidation.score >= 60) {
      quality = "中";
    }

    if (result.confidence < 70) {
      recommendations.push("データソースの信頼性を向上させる必要があります");
    }

    if (dataValidation.errors.length > 0) {
      recommendations.push("必須データの取得に失敗しています");
    }

    if (dataValidation.warnings.length > 0) {
      recommendations.push("データの妥当性に問題があります");
    }

    return {
      isValid: dataValidation.isValid && result.success,
      quality,
      recommendations,
    };
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    // 修正版：reduce の型を明示し、unknown で統一
    return path
      .split(".")
      .reduce<unknown>(
        (current, key) =>
          current && typeof current === "object" && key in current
            ? (current as Record<string, unknown>)[key]
            : undefined,
        obj
      );
  }

  private isValidISODate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && dateString.includes("T");
  }

  // 複数のデータソースから最適なデータを選択
  selectBestData(results: CollectorResult[]): {
    selectedData: Partial<StockData>;
    selectedSource: string;
    confidence: number;
    reasons: string[];
  } {
    if (results.length === 0) {
      return {
        selectedData: {},
        selectedSource: "",
        confidence: 0,
        reasons: ["データソースがありません"],
      };
    }

    // 各結果の品質を評価
    const evaluatedResults = results.map(result => ({
      result,
      validation: this.validateCollectorResult(result),
      dataValidation: this.validateStockData(result.data),
    }));

    // 品質と信頼度でソート
    const sortedResults = evaluatedResults.sort((a, b) => {
      const scoreA = a.dataValidation.score + a.result.confidence;
      const scoreB = b.dataValidation.score + b.result.confidence;
      return scoreB - scoreA;
    });

    const best = sortedResults[0];
    const reasons: string[] = [];

    // 選択理由の説明
    reasons.push(`${best.result.source}から最高品質のデータを取得`);
    reasons.push(
      `信頼度: ${best.result.confidence}%, データ品質: ${best.dataValidation.score}%`
    );

    if (best.validation.quality === "高") {
      reasons.push("高品質なデータが取得できました");
    } else if (best.validation.quality === "中") {
      reasons.push("中程度の品質のデータです");
    } else {
      reasons.push("データ品質に改善の余地があります");
    }

    return {
      selectedData: best.result.data,
      selectedSource: best.result.source,
      confidence: Math.round(
        (best.result.confidence + best.dataValidation.score) / 2
      ),
      reasons,
    };
  }
}
