/**
 * Lemon Squeezy API クライアント
 */

import { sanitizeError } from "@/lib/utils/logSanitizer";

const LEMON_SQUEEZY_API_URL = "https://api.lemonsqueezy.com/v1";

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
    throw new Error("LEMON_SQUEEZY_API_KEY is not set");
  }

  if (!storeId) {
    throw new Error("LEMON_SQUEEZY_STORE_ID is not set");
  }

  const response = await fetch(`${LEMON_SQUEEZY_API_URL}/checkouts`, {
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
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * サブスクリプション情報を取得
 */
export async function getSubscription(subscriptionId: string) {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;

  if (!apiKey) {
    throw new Error("LEMON_SQUEEZY_API_KEY is not set");
  }

  const response = await fetch(
    `${LEMON_SQUEEZY_API_URL}/subscriptions/${subscriptionId}`,
    {
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get subscription: ${response.status}`);
  }

  return response.json();
}

/**
 * サブスクリプションをキャンセル
 */
export async function cancelSubscription(subscriptionId: string) {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;

  if (!apiKey) {
    throw new Error("LEMON_SQUEEZY_API_KEY is not set");
  }

  const response = await fetch(
    `${LEMON_SQUEEZY_API_URL}/subscriptions/${subscriptionId}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to cancel subscription: ${response.status}`);
  }

  return response.json();
}
