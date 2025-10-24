import { z } from "zod";

// 検索クエリの検証スキーマ
export const searchSchema = z.object({
  query: z
    .string()
    .min(1, "検索クエリが必要です")
    .max(100, "検索クエリは100文字以内で入力してください")
    .regex(
      /^[a-zA-Z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\s:.-]+$/,
      "無効な文字が含まれています"
    )
    .transform(val => val.trim()),
  chartPeriod: z
    .enum(["1D", "1W", "1M", "3M", "1Y"], {
      errorMap: () => ({ message: "無効な期間が指定されています" }),
    })
    .optional()
    .default("1M"),
});

// 分析リクエストの検証スキーマ
export const analysisSchema = z.object({
  companyInfo: z.object({
    name: z.string().min(1, "企業名が必要です"),
    symbol: z.string().min(1, "シンボルが必要です"),
    market: z.string().optional(),
    price: z.number().positive().optional(),
    change: z.number().optional(),
    changePercent: z.number().optional(),
    description: z.string().optional(),
    website: z.string().url().optional().or(z.literal("")),
    employees: z.string().optional(),
    founded: z.string().optional(),
    headquarters: z.string().optional(),
  }),
  stockData: z.object({
    symbol: z.string().min(1, "シンボルが必要です"),
    price: z.number().positive("価格は正の数である必要があります"),
    change: z.number(),
    changePercent: z.number(),
    volume: z.number().nonnegative("出来高は0以上である必要があります"),
    marketCap: z.string(),
    pe: z.number().nonnegative().optional(),
    eps: z.number().optional(),
    dividend: z.number().nonnegative().optional(),
    high52: z.number().positive().optional(),
    low52: z.number().positive().optional(),
  }),
  newsData: z
    .array(
      z.object({
        title: z.string(),
        snippet: z.string(),
        link: z.string().url(),
        source: z.string(),
        date: z.string(),
      })
    )
    .optional()
    .default([]),
});

// 型のエクスポート
export type SearchRequest = z.infer<typeof searchSchema>;
export type AnalysisRequest = z.infer<typeof analysisSchema>;
