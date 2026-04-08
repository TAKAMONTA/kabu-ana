/**
 * APIクライアントのユーティリティ
 * Capacitorアプリ（静的エクスポート）でも動作するように、本番環境のAPI URLを使用
 */

/**
 * APIのベースURLを取得
 * 優先順位:
 * 1. 環境変数 NEXT_PUBLIC_API_BASE_URL
 * 2. Capacitor環境の場合は本番環境のURL
 * 3. ブラウザ環境の場合は相対パス
 */
export function getApiBaseUrl(): string {
  // 環境変数で指定されている場合はそれを使用
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  // Capacitor環境かどうかをチェック
  const isCapacitor = typeof window !== "undefined" && 
    (window as any).Capacitor !== undefined;

  if (isCapacitor) {
    // Capacitorアプリの場合は本番環境のURLを使用
    // 環境変数 NEXT_PUBLIC_PRODUCTION_URL に本番環境のURLを設定してください
    // 例: "https://your-app.vercel.app"
    const productionUrl =
      process.env.NEXT_PUBLIC_PRODUCTION_URL || "https://kabu-ana.com";
    if (productionUrl) {
      return productionUrl;
    }
    
    // 本番URLが設定されていない場合
    // capacitor://localhost の場合は、APIが動作しないため空文字を返す
    // フォールバックデータが使用される
    if (typeof window !== "undefined" && window.location.origin === "capacitor://localhost") {
      console.warn("⚠️ Capacitor環境でAPI URLが設定されていません。本番環境のURLを設定してください。");
      console.warn("⚠️ 現在はフォールバックデータが使用されます。");
      return "";
    }
    
    // その他の場合は現在のオリジンを試す
    if (typeof window !== "undefined" && window.location.origin) {
      return window.location.origin;
    }
  }

  // デフォルトは相対パス（Web版）
  return "";
}

/**
 * 認証付きfetchリクエスト用のヘッダーを生成する。
 * Firebase Auth のログインユーザーがいれば Authorization ヘッダーを付与。
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  try {
    const { auth } = await import("@/lib/firebase");
    if (auth?.currentUser) {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
  } catch {
    // Firebase未初期化の場合は認証なしで続行
  }
  return headers;
}

/**
 * APIエンドポイントの完全なURLを取得
 */
export function getApiUrl(endpoint: string): string {
  const baseUrl = getApiBaseUrl();
  // エンドポイントが既に完全なURLの場合はそのまま返す
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }
  // エンドポイントが / で始まる場合は結合
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return baseUrl ? `${baseUrl}${cleanEndpoint}` : cleanEndpoint;
}
