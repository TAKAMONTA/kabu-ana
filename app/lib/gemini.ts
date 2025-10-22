// OpenRouter API統合ライブラリ
// Windows環境対応

// OpenRouter APIで利用可能なモデル定義（2025年1月更新）
export const ANALYSIS_MODELS = {
  // 基本情報取得 - バランスの良い総合分析
  basic_info: 'openai/gpt-4o-mini',
  // 財務分析 - 高精度な数値分析と論理的推論
  financial: 'anthropic/claude-3-haiku',
  // 市場センチメント - リアルタイム情報取得
  sentiment: 'openai/gpt-3.5-turbo',
  // 競合分析 - 幅広い比較分析
  competitor: 'openai/gpt-4o-mini',
  // リスク評価 - 論理的リスク分析
  risk: 'anthropic/claude-3-haiku',
  // フォールバック用 - コスト効率の良いモデル
  fallback: 'openai/gpt-3.5-turbo'
} as const;

// OpenRouter APIクライアントの初期化
export function getOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }
  
  return {
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1'
  };
}

// OpenRouter APIを使用した検索・分析機能（エラーハンドリング強化版）
export async function searchWithOpenRouter(
  query: string, 
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    enableFallback?: boolean;
  }
) {
  const client = getOpenRouterClient();
  const model = options?.model || ANALYSIS_MODELS.basic_info;
  
  try {
    console.log(`Attempting OpenRouter API call with model: ${model}`);
    
    const response = await fetch(`${client.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${client.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'Kabu Analysis App'
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: query
          }
        ],
        temperature: options?.temperature || 0.3,
        max_tokens: options?.maxTokens || 2000,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || errorData.message || 'Unknown error';
      
      // モデルが見つからない場合の特別処理
      if (response.status === 404 || errorMessage.includes('not found') || errorMessage.includes('Invalid model')) {
        console.warn(`Model ${model} not available, attempting fallback`);
        
        if (options?.enableFallback && model !== ANALYSIS_MODELS.fallback) {
          console.log(`Falling back to ${ANALYSIS_MODELS.fallback}`);
          return searchWithOpenRouter(query, {
            ...options,
            model: ANALYSIS_MODELS.fallback,
            enableFallback: false // 無限ループ防止
          });
        }
      }
      
      throw new Error(`OpenRouter API error: ${response.status} - ${errorMessage}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content received from OpenRouter API');
    }
    
    console.log(`OpenRouter API call successful with model: ${model}`);
    return {
      success: true,
      content,
      model,
      usage: data.usage
    };
  } catch (error) {
    console.error(`OpenRouter API error with model ${model}:`, error);
    
    // フォールバック機能
    if (options?.enableFallback && model !== ANALYSIS_MODELS.fallback) {
      console.log(`Error occurred, falling back to ${ANALYSIS_MODELS.fallback}`);
      return searchWithOpenRouter(query, {
        ...options,
        model: ANALYSIS_MODELS.fallback,
        enableFallback: false // 無限ループ防止
      });
    }
    
    // フォールバックも失敗した場合、エラー情報を含む結果を返す
    return {
      success: false,
      content: null,
      model,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 段階的分析用のOpenRouter検索
export async function performStageAnalysis(
  stage: string,
  companyName: string,
  stockCode: string,
  market: 'JP' | 'US'
) {
  const queries = getStageQueries(stage, companyName, stockCode, market);
  const results = [];
  
  // 段階に応じて最適なモデルを選択
  const stageModel = getOptimalModelForStage(stage);
  
  for (const query of queries) {
    try {
      const result = await searchWithOpenRouter(query.prompt, {
        model: stageModel,
        temperature: 0.3,
        maxTokens: 2000,
        enableFallback: true
      });
      
      results.push({
        type: query.type,
        content: result.content,
        success: true,
        model: result.model,
        usage: result.usage
      });
    } catch (error) {
      console.error(`Stage ${stage} analysis failed for ${query.type}:`, error);
      results.push({
        type: query.type,
        content: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return results;
}

// 段階に応じた最適なモデル選択
function getOptimalModelForStage(stage: string): string {
  switch (stage) {
    case 'basic_info':
      return ANALYSIS_MODELS.basic_info;
    case 'financial_analysis':
      return ANALYSIS_MODELS.financial;
    case 'market_sentiment':
      return ANALYSIS_MODELS.sentiment;
    case 'competitor_analysis':
      return ANALYSIS_MODELS.competitor;
    case 'risk_opportunity':
      return ANALYSIS_MODELS.risk;
    default:
      return ANALYSIS_MODELS.basic_info;
  }
}

// 段階別クエリの定義
function getStageQueries(
  stage: string,
  companyName: string,
  stockCode: string,
  market: 'JP' | 'US'
) {
  const baseInfo = market === 'JP' 
    ? `日本株 ${companyName}（銘柄コード: ${stockCode}）`
    : `米国株 ${companyName}（ティッカー: ${stockCode}）`;

  switch (stage) {
    case 'basic_info':
      return [
        {
          type: 'company_overview',
          prompt: `${baseInfo}について、以下の情報を詳細に調査してください：
1. 企業の事業内容と主力製品・サービス
2. 業界での地位と競合他社
3. 最新の企業概要（設立年、従業員数、本社所在地）
4. 公式ウェブサイトのURL
5. 所属業界・セクター

信頼できる企業情報サイト、公式IR情報、証券会社のレポートを参照して、正確な情報を提供してください。`
        }
      ];

    case 'financial_analysis':
      return [
        {
          type: 'financial_metrics',
          prompt: `${baseInfo}の最新の財務指標を以下の項目で詳細に分析してください：

**収益性指標:**
- ROE（自己資本利益率）
- ROA（総資産利益率）
- 売上高営業利益率
- 売上高純利益率

**安全性指標:**
- 自己資本比率
- 流動比率
- 当座比率
- D/E比率（負債自己資本比率）

**成長性指標:**
- 売上高成長率（過去3年間）
- 営業利益成長率（過去3年間）
- 純利益成長率（過去3年間）

**効率性指標:**
- 総資産回転率
- 在庫回転率
- 売上債権回転率

**株式指標:**
- PER（株価収益率）
- PBR（株価純資産倍率）
- 配当利回り
- 配当性向

最新の決算資料、IR情報、証券会社のアナリストレポートを参照して、具体的な数値と業界平均との比較も含めて分析してください。`
        },
        {
          type: 'cash_flow_analysis',
          prompt: `${baseInfo}のキャッシュフロー分析を行ってください：

**営業キャッシュフロー:**
- 営業CFの推移（過去3年間）
- 営業CFマージン
- 売上高営業CF比率

**投資キャッシュフロー:**
- 設備投資の状況
- M&A活動
- 投資効率

**財務キャッシュフロー:**
- 借入・返済状況
- 配当支払い状況
- 自己株式取得

**フリーキャッシュフロー:**
- FCFの推移と安定性
- FCF利回り

最新の決算短信やキャッシュフロー計算書を参照して、企業の資金繰りと投資戦略を分析してください。`
        }
      ];

    case 'market_sentiment':
      return [
        {
          type: 'news_analysis',
          prompt: `${baseInfo}に関する最近1ヶ月間のニュースと市場の反応を分析してください：

**ニュース分析:**
- ポジティブなニュース（業績好調、新製品発表、提携など）
- ネガティブなニュース（業績悪化、問題発生、規制など）
- 中立的なニュース（一般的な業界動向など）

**市場の反応:**
- ニュース発表後の株価変動
- 出来高の変化
- アナリストの評価変更

**投資家センチメント:**
- 機関投資家の動向
- 個人投資家の関心度
- SNSでの言及状況

信頼できるニュースサイト、証券会社のレポート、投資情報サイトを参照してください。`
        },
        {
          type: 'analyst_ratings',
          prompt: `${baseInfo}に対する証券アナリストの評価と投資判断を調査してください：

**アナリスト評価:**
- 主要証券会社の投資判断（買い/中立/売り）
- 目標株価の設定状況
- レーティングの変更履歴

**業績予想:**
- 今期・来期の業績予想
- 予想の修正状況
- コンセンサス予想との比較

**投資ポイント:**
- アナリストが注目する成長要因
- 懸念材料・リスク要因
- 投資判断の根拠

複数の証券会社のアナリストレポートを参照して、総合的な評価を提供してください。`
        }
      ];

    case 'competitor_analysis':
      return [
        {
          type: 'industry_comparison',
          prompt: `${baseInfo}の業界分析と競合比較を行ってください：

**業界分析:**
- 業界の市場規模と成長性
- 業界のトレンドと将来性
- 主要な成長ドライバー
- 業界特有のリスク要因

**競合他社比較:**
- 主要競合企業（3-5社）の特定
- 市場シェアの比較
- 財務指標の比較（売上高、利益率、ROEなど）
- 競争優位性の分析

**ポジショニング:**
- 業界内での地位
- 差別化要因
- 強み・弱みの分析

業界レポート、市場調査資料、競合他社の決算資料を参照してください。`
        }
      ];

    case 'risk_opportunity':
      return [
        {
          type: 'risk_assessment',
          prompt: `${baseInfo}の投資リスクを包括的に分析してください：

**事業リスク:**
- 主力事業の依存度
- 顧客・地域の集中リスク
- 技術革新への対応リスク
- 規制変更リスク

**財務リスク:**
- 財務レバレッジ
- 流動性リスク
- 為替リスク（該当する場合）
- 金利変動リスク

**市場リスク:**
- 株価ボラティリティ
- 業界サイクルの影響
- 経済環境の変化

**ESGリスク:**
- 環境対応
- 社会的責任
- ガバナンス体制

各リスクの影響度と発生可能性を評価してください。`
        },
        {
          type: 'growth_opportunities',
          prompt: `${baseInfo}の成長機会と投資魅力を分析してください：

**成長機会:**
- 新市場・新事業への展開
- 技術革新による競争力向上
- M&A・提携による成長
- 海外展開の可能性

**投資魅力:**
- バリュエーションの妥当性
- 配当政策と株主還元
- 中長期的な成長ストーリー
- ESG取り組みによる価値向上

**カタリスト:**
- 短期的な株価上昇要因
- 中長期的な価値向上要因
- 業界全体の追い風

投資価値と成長ポテンシャルを総合的に評価してください。`
        }
      ];

    default:
      return [];
  }
}

// 分析結果を構造化データに変換
export function parseAnalysisResult(
  stage: string,
  results: Array<{ type: string; content: string | null; success: boolean }>
) {
  const parsedData: any = {};
  
  results.forEach(result => {
    if (result.success && result.content) {
      parsedData[result.type] = result.content;
    }
  });
  
  return {
    stage,
    data: parsedData,
    timestamp: new Date().toISOString()
  };
}
