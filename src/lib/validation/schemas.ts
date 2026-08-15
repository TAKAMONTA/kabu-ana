import { z } from "zod";

// 検索クエリの検証スキーマ
export const searchSchema = z.object({
  query: z
    .string()
    .min(1, "検索クエリが必要です")
    .max(100, "検索クエリは100文字以内で入力してください")
    // 許可文字集合は JPX 銘柄マスタ（stockMaster.generated.json）の
    // 全銘柄名4252件を実測で走査して決めている。ここを狭めると
    // 「単体テストは緑なのに実HTTPは400」という事故が起きるため、
    // 変更時は searchCoverage.test.ts の (d) を必ず通すこと。
    //
    // 半角と全角の双方を許可するのは、正式名称が全角（例: ＪＰＸ／Ｓ＆Ｐ）でも
    // ユーザーは半角キーボードで打つため。照合側は NFKC で畳むので双方一致する。
    //   \u002c \uff0c \u3001   「ホテル、ニューグランド」(9720)
    //   \u002e \uff0e \u3002   「Ｊ．フロント　リテイリング」(3086)
    //   \u002f \uff0f          「ｉシェアーズ　ＪＰＸ／Ｓ＆Ｐ設備・人材投資　ＥＴＦ」(1483)
    //   \u002b \uff0b          「ｉＦｒｅｅＥＴＦ　ＦＡＮＧ＋」(316A)
    //   \u0025 \uff05          「…半導体製造装置３５％キャップ指数連動型上場投信」(346A)
    //   \u2010                 「Ａｏｂａ‐ＢＢＴ」(2464)。半角ハイフンとは別文字。
    //   \u0391-\u03c9           「上場インデックスファンド…（βヘッジ）」(1490)
    // 旧集合に対して純粋な追加（69コードポイント増・削除0）であり、
    // 追加分は下流で encodeURIComponent 済みのURLにしか渡らない。
    .regex(
      /^[a-zA-Z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\s:.,&()+\/%\u0391-\u03c9\u2010\u2212\u3001\u3002\uff05\uff06\uff08\uff09\uff0b\uff0c\uff0e\uff0f\uff10-\uff19\uff21-\uff3a\uff41-\uff5a\uff0d-]+$/,
      "無効な文字が含まれています"
    )
    .transform(val => val.trim()),
  chartPeriod: z
    .enum(["1D", "5D", "1W", "1M", "3M", "6M", "1Y", "5Y", "MAX"], {
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
    price: z.number().optional(),
    change: z.number().optional(),
    changePercent: z.number().optional(),
    description: z.string().optional(),
    website: z.string().optional(),
    employees: z.string().optional(),
    founded: z.string().optional(),
    headquarters: z.string().optional(),
  }),
  stockData: z.object({
    symbol: z.string().min(1, "シンボルが必要です"),
    price: z.number(),
    change: z.number(),
    changePercent: z.number(),
    volume: z.number(),
    marketCap: z.string(),
    pe: z.number().optional(),
    eps: z.number().optional(),
    dividend: z.number().optional(),
    high52: z.number().optional(),
    low52: z.number().optional(),
  }),
  newsData: z
    .array(
      z.object({
        title: z.string(),
        snippet: z.string(),
        link: z.string(),
        source: z.string(),
        date: z.string(),
      })
    )
    .optional()
    .default([]),
  // EDINET DB由来の拡張データ（AI分析の燃料・日本企業のみ）
  edinetExtras: z
    .object({
      ratios: z.any().optional().nullable(),
      financialHistory: z.array(z.any()).optional().nullable(),
      accountingStandard: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  // 会話型UIからの質問（任意）
  question: z.string().max(500).optional().nullable(),
});

// 型のエクスポート
export type SearchRequest = z.infer<typeof searchSchema>;
export type AnalysisRequest = z.infer<typeof analysisSchema>;
