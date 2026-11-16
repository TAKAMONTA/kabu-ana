/**
 * OpenRouter APIキーの設定判定（全ルート共通）。
 *
 * 以前はルートごとにプレースホルダーの判定がばらばらで、analyze は
 * "your_openrouter_key_here"、financial-evaluation / news-analysis は
 * "your_openrouter_api_key_here"（.env.example の値）しか弾いていなかった。
 */
const OPENROUTER_PLACEHOLDER_KEYS = new Set([
  "your_openrouter_api_key_here",
  "your_openrouter_key_here",
]);

/** 設定済みの OpenRouter APIキー。未設定・プレースホルダーなら null */
export function getOpenRouterApiKey(): string | null {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey || OPENROUTER_PLACEHOLDER_KEYS.has(apiKey)) return null;
  return apiKey;
}

export function isOpenRouterConfigured(): boolean {
  return getOpenRouterApiKey() !== null;
}

/**
 * AI機能が設定不備で使えないときにクライアントへ返す固定文言（HTTP 503）。
 * 環境変数名や設定手順は含めない（サーバーログにだけ残す）。
 */
export const AI_SERVICE_UNAVAILABLE_MESSAGE =
  "現在AI分析を利用できません。時間をおいて再度お試しください。";
