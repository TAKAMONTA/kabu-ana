import { z } from "zod";

/** LLM が欠損・空文字を返しても落とさない。ticker が空の行は除去。 */
const morningBriefStockRaw = z.object({
  ticker: z.unknown(),
  reason: z.unknown(),
  direction: z.unknown(),
});

const morningBriefStockParsed = morningBriefStockRaw.transform(
  (
    row
  ): {
    ticker: string;
    reason: string;
    direction: "up" | "down" | "watch";
  } | null => {
    const ticker = typeof row.ticker === "string" ? row.ticker.trim() : "";
    if (!ticker) return null;
    const d = row.direction;
    const direction: "up" | "down" | "watch" =
      d === "up" || d === "down" || d === "watch" ? d : "watch";
    const r = row.reason;
    const reason =
      typeof r === "string"
        ? r.trim()
        : r !== null && r !== undefined
          ? String(r).trim()
          : "";
    return {
      ticker,
      reason: reason.length > 0 ? reason : "（補足なし）",
      direction,
    };
  }
);

export const claudeMorningBriefSchema = z.object({
  headline_jp: z.string().max(15),
  summary_jp: z.string().max(120),
  key_drivers: z
    .array(z.object({ factor: z.string(), impact: z.string() }))
    .default([]),
  stocks_to_watch: z
    .array(morningBriefStockParsed)
    .default([])
    .transform(items =>
      items.filter((item): item is NonNullable<typeof item> => item !== null)
    ),
  risk_outlook: z.enum(["low", "elevated", "high", "critical"]),
});

export const claudeDeepDiveSchema = z.object({
  causes: z
    .array(z.object({ hypothesis: z.string(), rationale: z.string() }))
    .length(3),
  scenarios: z
    .array(z.object({ scenario: z.string(), trigger: z.string() }))
    .length(3),
});

export type ClaudeMorningBrief = z.infer<typeof claudeMorningBriefSchema>;
export type ClaudeDeepDive = z.infer<typeof claudeDeepDiveSchema>;

export function buildMorningBriefPrompt(input: unknown): string {
  return `
直近24時間の市場シグナルを日本株トレーダー向けに要約してください。必ずJSONのみで返してください。

【重要】stocks_to_watch の各オブジェクトは ticker・reason・direction の3つのキーを必ず全て含めること。1つでも欠けているとパースに失敗します。

制約:
- headline_jp は最大15字
- summary_jp は120字以内
- stocks_to_watch は日本株を中心に最大5件
  - "ticker": 銘柄コード（例: "7203"）— 必須、文字列
  - "reason": 理由（短文）— 必須、文字列
  - "direction": "up" / "down" / "watch" のいずれか — 必須、この3値以外は使用不可
- risk_outlook は low / elevated / high / critical のいずれか

出力スキーマ例（キー名と型を厳守。省略・追加・変更不可）:
{
  "headline_jp": "15字以内の見出し",
  "summary_jp": "120字以内の要約",
  "key_drivers": [{"factor": "要因", "impact": "影響"}],
  "stocks_to_watch": [
    {"ticker": "7203", "reason": "円安メリット大きい", "direction": "up"},
    {"ticker": "9984", "reason": "金利動向に要注意", "direction": "watch"},
    {"ticker": "8035", "reason": "半導体需要一服", "direction": "down"}
  ],
  "risk_outlook": "elevated"
}

入力:
${JSON.stringify(input, null, 2)}
`.trim();
}

export function buildDeepDivePrompt(input: unknown): string {
  return `
単一シグナルについて、日本株への影響を深掘りしてください。必ずJSONのみで返してください。

出力:
{
  "causes": [{"hypothesis": "原因仮説", "rationale": "根拠"}] x 3,
  "scenarios": [{"scenario": "次の展開", "trigger": "確認すべき指標"}] x 3
}

入力:
${JSON.stringify(input, null, 2)}
`.trim();
}

export function extractJsonObject(content: string): unknown {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude response did not include JSON");
  return JSON.parse(match[0]);
}
