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
      error: () => "無効な期間が指定されています",
    })
    .optional()
    .default("1M"),
});

/**
 * LLM のプロンプトにそのまま入る値には上限を設ける（巨大な入力 = AI課金の増大を
 * 400 で弾く）。上限は検索APIが実際に返す値よりも十分大きくしてある。
 */
const boundedString = (max: number) => z.string().max(max);
const optionalNumber = z.number().nullable().optional();

/** EDINET DB 由来の財務指標（/api/search の ratios と同じキー。値は比率・金額の数値） */
export const edinetRatiosSchema = z.object({
  roe: optionalNumber,
  roa: optionalNumber,
  operatingMargin: optionalNumber,
  netMargin: optionalNumber,
  grossMargin: optionalNumber,
  equityRatio: optionalNumber,
  currentRatio: optionalNumber,
  deRatio: optionalNumber,
  fcf: optionalNumber,
  ebitda: optionalNumber,
  revenueGrowth: optionalNumber,
  niGrowth: optionalNumber,
  revenueCagr3y: optionalNumber,
  niCagr3y: optionalNumber,
  dividendYield: optionalNumber,
});

/** EDINET DB 由来の財務推移1年分（/api/search の financialHistory と同じ形） */
export const edinetFinancialHistoryItemSchema = z.object({
  fiscalYear: z.union([z.number(), boundedString(10)]),
  revenue: optionalNumber,
  operatingIncome: optionalNumber,
  netIncome: optionalNumber,
  eps: optionalNumber,
  totalAssets: optionalNumber,
  cfOperating: optionalNumber,
});

// EDINET DB由来の拡張データ（AI分析の燃料・日本企業のみ）
// 以前は ratios: z.any() / financialHistory: z.array(z.any()) で、文字列の deRatio などが
// buildEdinetSections の toFixed で TypeError（500）になっていた。
export const edinetExtrasSchema = z
  .object({
    ratios: edinetRatiosSchema.optional().nullable(),
    financialHistory: z
      .array(edinetFinancialHistoryItemSchema)
      .max(20)
      .optional()
      .nullable(),
    accountingStandard: boundedString(50).optional().nullable(),
  })
  .optional()
  .nullable();

export const newsItemSchema = z.object({
  title: boundedString(1000),
  snippet: boundedString(5000),
  link: boundedString(2048),
  source: boundedString(500),
  date: boundedString(200),
});

// 分析リクエストの検証スキーマ
export const analysisSchema = z.object({
  companyInfo: z.object({
    name: z.string().min(1, "企業名が必要です").max(200),
    symbol: z.string().min(1, "シンボルが必要です").max(20),
    market: boundedString(100).optional(),
    price: z.number().optional(),
    change: z.number().optional(),
    changePercent: z.number().optional(),
    description: boundedString(10000).optional(),
    website: boundedString(2048).optional(),
    employees: boundedString(100).optional(),
    founded: boundedString(100).optional(),
    headquarters: boundedString(500).optional(),
  }),
  stockData: z.object({
    symbol: z.string().min(1, "シンボルが必要です").max(20),
    price: z.number(),
    change: z.number(),
    changePercent: z.number(),
    volume: z.number(),
    marketCap: boundedString(100),
    pe: z.number().optional(),
    eps: z.number().optional(),
    dividend: z.number().optional(),
    high52: z.number().optional(),
    low52: z.number().optional(),
  }),
  newsData: z.array(newsItemSchema).max(30).optional().default([]),
  edinetExtras: edinetExtrasSchema,
  // 会話型UIからの質問（任意）
  question: z.string().max(500).optional().nullable(),
});

/** 財務データの1項目（J-Quants 等は文字列、数値で来ることもある） */
const financialValue = z
  .union([boundedString(100), z.number()])
  .nullable()
  .optional();

// 財務評価リクエスト（/api/financial-evaluation）の検証スキーマ
export const financialEvaluationSchema = z.object({
  symbol: z.string().trim().min(1, "シンボルが必要です").max(20),
  companyName: z.string().trim().min(1, "企業名が必要です").max(200),
  financialData: z
    .object({
      revenue: financialValue,
      operatingIncome: financialValue,
      netIncome: financialValue,
      eps: financialValue,
      totalAssets: financialValue,
      totalLiabilities: financialValue,
      cash: financialValue,
      period: financialValue,
      equityRatio: financialValue,
      debtRatio: financialValue,
      operatingCashFlow: financialValue,
      investingCashFlow: financialValue,
      financingCashFlow: financialValue,
    })
    .nullable()
    .optional(),
  edinetExtras: edinetExtrasSchema,
});

// 検索候補（/api/search-suggestions）の検証スキーマ。
// 型と長さ（/api/search と同じ100文字）が不正なら 400。候補は入力途中の文字列で
// 呼ばれるため、短すぎる・許可文字（searchSchema と同じ集合）外の入力は
// 400 ではなく空配列で返す（ルート側で判定）。
export const searchSuggestionsSchema = z.object({
  query: z.string().max(100),
});

// 型のエクスポート
export type SearchRequest = z.infer<typeof searchSchema>;
export type AnalysisRequest = z.infer<typeof analysisSchema>;
export type FinancialEvaluationRequest = z.infer<typeof financialEvaluationSchema>;
