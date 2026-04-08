import { z } from "zod";

// 検索クエリの検証スキーマ
export const searchSchema = z.object({
  query: z
    .string({
      required_error: "検索クエリが必要です",
      invalid_type_error: "検索クエリは文字列である必要があります",
    })
    .min(1, "検索クエリが必要です")
    .max(100, "検索クエリは100文字以内で入力してください")
    .regex(
      /^[a-zA-Z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\s:.-]+$/,
      "検索クエリに無効な文字が含まれています。英数字、日本語、記号(:.-)のみ使用できます。"
    )
    .transform(val => val.trim()),
  chartPeriod: z
    .enum(["1D", "5D", "1W", "1M", "3M", "6M", "1Y", "5Y", "MAX"], {
      errorMap: () => ({ message: "無効な期間が指定されています" }),
    })
    .optional()
    .default("1M"),
});

const coerceNumber = z.preprocess(
  (val) => (val === null || val === undefined ? undefined : Number(val)),
  z.number().optional()
);

const coerceNumberRequired = z.preprocess(
  (val) => (val === null || val === undefined ? 0 : Number(val)),
  z.number()
);

const coerceString = z.preprocess(
  (val) => (val === null || val === undefined ? undefined : String(val)),
  z.string().optional()
);

// 分析リクエストの検証スキーマ
export const analysisSchema = z.object({
  companyInfo: z.object({
    name: z.string().min(1, "企業名が必要です"),
    symbol: z.string().min(1, "シンボルが必要です"),
    market: coerceString,
    price: coerceNumber,
    change: coerceNumber,
    changePercent: coerceNumber,
    description: coerceString,
    website: coerceString,
    employees: coerceString,
    founded: coerceString,
    headquarters: coerceString,
  }),
  stockData: z.object({
    symbol: z.string().min(1, "シンボルが必要です"),
    price: coerceNumberRequired,
    change: coerceNumberRequired,
    changePercent: coerceNumberRequired,
    volume: coerceNumberRequired,
    marketCap: z.preprocess(
      (val) => (val === null || val === undefined ? "0" : String(val)),
      z.string()
    ),
    pe: coerceNumber,
    eps: coerceNumber,
    dividend: coerceNumber,
    high52: coerceNumber,
    low52: coerceNumber,
  }),
  newsData: z
    .array(
      z.object({
        title: z.preprocess((v) => v ?? "", z.string()),
        snippet: z.preprocess((v) => v ?? "", z.string()),
        link: z.preprocess((v) => v ?? "", z.string()),
        source: z.preprocess((v) => v ?? "", z.string()),
        date: z.preprocess((v) => v ?? "", z.string()),
      })
    )
    .optional()
    .default([]),
});

// 型のエクスポート
export type SearchRequest = z.infer<typeof searchSchema>;
export type AnalysisRequest = z.infer<typeof analysisSchema>;
