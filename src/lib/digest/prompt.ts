/** ダイジェスト生成に渡す1銘柄分の材料 */
export interface DigestStockInput {
  code: string;
  name: string;
  close?: number;
  changePercent?: number;
  /** 株価の基準日（YYYY-MM-DD） */
  asOf?: string;
  headlines: string[];
}

/**
 * 朝ダイジェスト用のユーザープロンプトを組み立てる。
 * 出力形式（JSON）と禁止事項（売買推奨）はここで明示する。
 */
export function buildDigestPrompt(stocks: DigestStockInput[]): string {
  const lines = stocks.map(s => {
    const price =
      s.close !== undefined && s.changePercent !== undefined
        ? `終値${s.close}円 前日比${s.changePercent.toFixed(2)}%` +
          (s.asOf ? `（${s.asOf}時点）` : "")
        : "株価データなし";
    const news =
      s.headlines.length > 0
        ? s.headlines.map(h => `「${h}」`).join(" / ")
        : "ニュースなし";
    return `- ${s.code} ${s.name}: ${price} / ニュース: ${news}`;
  });

  return [
    "以下はユーザーがウォッチしている銘柄の前日終値と直近ニュースです。",
    "個人投資家向けの朝のダイジェストを日本語で作ってください。",
    "",
    ...lines,
    "",
    "出力は次のJSONのみ（前後に文章を付けない）:",
    `{"marketLine": "対象銘柄全体を見た1行", "stockLines": [{"code": "銘柄コード", "line": "その銘柄の1行"}], "focusLine": "今日注目すべき点の1行"}`,
    "制約:",
    "- stockLines は入力の全銘柄について1件ずつ、入力と同じ順で",
    "- 各行は事実の整理と注目点の提示にとどめ、売買の推奨や将来の断定はしない",
    "- データなしの銘柄は「データが取得できなかった」ことを正直に書く",
    "- 各行は全角60文字以内",
  ].join("\n");
}
