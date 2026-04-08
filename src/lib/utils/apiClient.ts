/**
 * APIクライアントのユーティリティ
 * Capacitorアプリ（静的エクスポート）でも動作するように、本番環境のAPI URLを使用
 */

/**
 * APIのベースURLを取得
 */
export function getApiBaseUrl(): string {
    // Capacitor環境かどうかをチェック
    const isCapacitor = typeof window !== "undefined" &&
        ((window as any).Capacitor !== undefined || window.location.protocol === 'capacitor:');

    if (isCapacitor) {
        // Capacitorアプリの場合は本番環境のURLを使用
        // ビルド時に環境変数が埋め込まれる
        return "https://kabu-ana.com";
    }

    // デフォルトは相対パス（Web版）
    return "";
}

/**
 * 認証付きリクエスト用のヘッダーを生成する。
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
