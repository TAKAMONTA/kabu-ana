import { z } from "zod";

export const claudeMorningBriefSchema = z.object({
  headline_jp: z.string().max(15),
  summary_jp: z.string().max(120),
  key_drivers: z.array(z.object({ factor: z.string(), impact: z.string() })).default([]),
  stocks_to_watch: z.array(z.object({
    ticker: z.string(),
    reason: z.string(),
    direction: z.enum(["up", "down", "watch"]),
  })).default([]),
  risk_outlook: z.enum(["low", "elevated", "high", "critical"]),
});

export const claudeDeepDiveSchema = z.object({
  causes: z.array(z.object({ hypothesis: z.string(), rationale: z.string() })).length(3),
  scenarios: z.array(z.object({ scenario: z.string(), trigger: z.string() })).length(3),
});

export type ClaudeMorningBrief = z.infer<typeof claudeMorningBriefSchema>;
export type ClaudeDeepDive = z.infer<typeof claudeDeepDiveSchema>;

export function buildMorningBriefPrompt(input: unknown): string {
  return `
直近24時間の市場シグナルを日本株トレーダー向けに要約してください。必ずJSONのみで返してください。

制約:
- headline_jp は最大15字
- summary_jp は120字以内
- stocks_to_watch は日本株を中心に最大5件
- risk_outlook は low/elevated/high/critical

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
