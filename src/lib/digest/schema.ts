import { z } from "zod";
import { extractJsonObject } from "@/lib/signals/claude";

export const digestResponseSchema = z.object({
  marketLine: z.string().min(1).max(200),
  stockLines: z
    .array(
      z.object({
        code: z.string().min(1).max(20),
        line: z.string().min(1).max(200),
      })
    )
    .min(1)
    .max(10),
  focusLine: z.string().min(1).max(200),
});

export type DigestResponse = z.infer<typeof digestResponseSchema>;
export type DigestStockLine = DigestResponse["stockLines"][number];

/**
 * AI応答からダイジェストJSONを取り出して検証する。
 * 前後に説明文が混ざっていても extractJsonObject が最初のJSONを抜き出す。
 * 不正なら throw（呼び出し側で error 扱いにする）。
 */
export function parseDigestResponse(content: string): DigestResponse {
  return digestResponseSchema.parse(extractJsonObject(content));
}
