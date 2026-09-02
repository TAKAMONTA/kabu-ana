import { z } from "zod";
import { extractJsonObject } from "@/lib/signals/claude";

/**
 * 前後の空白を除去し、trim後に空なら拒否、上限を超えたら切り詰める。
 * AIが1行だけ長く書いた程度でダイジェスト全体を error にしないための緩和。
 * 先例: src/lib/signals/claude.ts の clampText（「長すぎる出力で検証エラーに
 * ならないよう、上限を超えたら切り詰める」）と同じ考え方。
 */
const clampText = (max: number) =>
  z
    .string()
    .transform(value => value.trim())
    .refine(value => value.length > 0, { message: "空文字は不可" })
    .transform(value =>
      value.length > max ? value.slice(0, max).trimEnd() : value
    );

export const digestResponseSchema = z.object({
  marketLine: clampText(200),
  stockLines: z
    .array(
      z.object({
        code: z.string().min(1).max(20),
        line: clampText(200),
      })
    )
    .min(1)
    .max(10),
  focusLine: clampText(200),
});

export type DigestResponse = z.infer<typeof digestResponseSchema>;
export type DigestStockLine = DigestResponse["stockLines"][number];

/**
 * AI応答からダイジェストJSONを取り出して検証する。
 * extractJsonObject は最初の `{` から最後の `}` までを貪欲マッチで取り出すため、
 * 前後に別の波括弧が混ざっていると失敗し error 扱いになる。
 * 不正なら throw（呼び出し側で error 扱いにする）。
 */
export function parseDigestResponse(content: string): DigestResponse {
  return digestResponseSchema.parse(extractJsonObject(content));
}
