/**
 * Lemon Squeezy API クライアント
 */

import { sanitizeError } from "@/lib/utils/logSanitizer";

const LEMON_SQUEEZY_API_URL = "https://api.lemonsqueezy.com/v1";
/** Lemon Squeezy API 呼び出しのタイムアウト */
const LEMON_SQUEEZY_TIMEOUT_MS = 15_000;

/**
 * Lemon Squeezy API の失敗。
 * - kind "config": APIキー等の未設定（呼び出し前に判明）
 * - kind "network": 接続失敗・タイムアウト
 * - kind "http": 非2xx応答（status に HTTP ステータス）
 * message は環境変数名を含み得るのでログ専用。クライアントには固定文言を返すこと。
 */
export class LemonSqueezyApiError extends Error {
  constructor(
    message: string,
    public readonly kind: "config" | "network" | "http",
    public readonly status?: number
  ) {
    super(message);
    this.name = "LemonSqueezyApiError";
  }
}

async function lemonSqueezyFetch(
  url: string,
  init: RequestInit
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(LEMON_SQUEEZY_TIMEOUT_MS),
    });
  } catch (error) {
    throw new LemonSqueezyApiError(
      `Lemon Squeezy API request failed: ${sanitizeError(error)}`,
      "network"
    );
  }
}

export interface LemonSqueezyCheckoutOptions {
  variantId: string;
  customData?: {
    userId?: string;
    email?: string;
  };
  productOptions?: {
    name?: string;
    description?: string;
    redirectUrl?: string;
  };
  checkoutOptions?: {
    embed?: boolean;
    media?: boolean;
    logo?: boolean;
    desc?: boolean;
    discount?: boolean;
    dark?: boolean;
    subscriptionPreview?: boolean;
  };
}

export interface LemonSqueezyCheckoutResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      url: string;
      [key: string]: any;
    };
  };
}

/**
 * チェックアウトセッションを作成
 */
export async function createCheckout(
  options: LemonSqueezyCheckoutOptions
): Promise<LemonSqueezyCheckoutResponse> {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
  const storeId = process.env.LEMON_SQUEEZY_STORE_ID;

  if (!apiKey) {
    throw new LemonSqueezyApiError("LEMON_SQUEEZY_API_KEY is not set", "config");
  }

  if (!storeId) {
    throw new LemonSqueezyApiError("LEMON_SQUEEZY_STORE_ID is not set", "config");
  }

  const response = await lemonSqueezyFetch(`${LEMON_SQUEEZY_API_URL}/checkouts`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          custom_price: null,
          product_options: {
            name: options.productOptions?.name,
            description: options.productOptions?.description,
            redirect_url: options.productOptions?.redirectUrl,
          },
          checkout_options: {
            embed: options.checkoutOptions?.embed ?? false,
            media: options.checkoutOptions?.media ?? true,
            logo: options.checkoutOptions?.logo ?? true,
            desc: options.checkoutOptions?.desc ?? true,
            discount: options.checkoutOptions?.discount ?? true,
            dark: options.checkoutOptions?.dark ?? false,
            subscription_preview:
              options.checkoutOptions?.subscriptionPreview ?? true,
          },
          checkout_data: {
            custom: options.customData,
          },
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: storeId,
            },
          },
          variant: {
            data: {
              type: "variants",
              id: options.variantId,
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorDetail =
      errorData?.errors?.[0]?.detail || errorData?.error || "";
    const sanitizedDetail = sanitizeError(errorDetail, [
      options.customData?.userId,
      options.customData?.email,
    ]);

    console.error("Lemon Squeezy API Error:", {
      status: response.status,
      statusText: response.statusText,
      detail: sanitizedDetail,
      variantId: options.variantId,
      storeId,
    });

    const errorMessage =
      sanitizedDetail || `Failed to create checkout: ${response.status}`;
    throw new LemonSqueezyApiError(errorMessage, "http", response.status);
  }

  return response.json();
}

/**
 * サブスクリプションの現在の状態（attributes.status）を取得する。
 * Lemon Squeezy 側に存在しなければ null。
 * https://docs.lemonsqueezy.com/api/subscriptions/retrieve-subscription
 */
export async function getSubscriptionStatus(
  subscriptionId: string
): Promise<string | null> {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
  if (!apiKey) {
    throw new LemonSqueezyApiError("LEMON_SQUEEZY_API_KEY is not set", "config");
  }

  const response = await lemonSqueezyFetch(
    `${LEMON_SQUEEZY_API_URL}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new LemonSqueezyApiError(
      `Failed to get subscription: ${response.status}`,
      "http",
      response.status
    );
  }
  const body = await response.json().catch(() => null);
  const status = body?.data?.attributes?.status;
  return typeof status === "string" ? status : null;
}

/**
 * サブスクリプションをキャンセル（自動更新を停止）する。
 * DELETE /v1/subscriptions/:id は即時削除ではなく cancelled 状態にし、
 * 支払い済み期間の終わり（ends_at）に expired になる。
 * https://docs.lemonsqueezy.com/api/subscriptions/cancel-subscription
 */
export async function cancelSubscription(subscriptionId: string) {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;

  if (!apiKey) {
    throw new LemonSqueezyApiError("LEMON_SQUEEZY_API_KEY is not set", "config");
  }

  const response = await lemonSqueezyFetch(
    `${LEMON_SQUEEZY_API_URL}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new LemonSqueezyApiError(
      `Failed to cancel subscription: ${response.status}`,
      "http",
      response.status
    );
  }

  return response.json().catch(() => null);
}
