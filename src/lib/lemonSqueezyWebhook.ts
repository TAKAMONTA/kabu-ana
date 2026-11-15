import { isSubscriptionPremium } from "@/lib/types/subscription";

/**
 * Lemon Squeezy Webhook のペイロード解釈（ルートから切り出した純粋関数群）。
 * Next.js の route.ts は GET/POST 等以外を export できないため、ここに置く。
 * 形の根拠: https://docs.lemonsqueezy.com/help/webhooks/event-types
 *           https://docs.lemonsqueezy.com/help/webhooks/example-payloads
 */

/**
 * Subscription オブジェクトを送ってくるイベント
 * （https://docs.lemonsqueezy.com/help/webhooks/event-types）。
 * subscription_updated は「最新状態の catch-all」として送られる。
 */
export const SUBSCRIPTION_OBJECT_EVENTS = new Set([
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_resumed",
  "subscription_expired",
  "subscription_paused",
  "subscription_unpaused",
]);

/**
 * Subscription invoice オブジェクトを送ってくるイベント。
 * invoice には renews_at / variant_id / product_id が無い（subscription_id はある）。
 * 状態の更新は同時に届く subscription_updated に任せ、ここでは受領だけ返す
 * （以前は Subscription として扱い undefined を set して毎回500になっていた）。
 */
export const SUBSCRIPTION_INVOICE_EVENTS = new Set([
  "subscription_payment_success",
  "subscription_payment_failed",
  "subscription_payment_recovered",
  "subscription_payment_refunded",
]);

type SubscriptionStatusValue =
  | "active"
  | "trial"
  | "pending"
  | "cancelled"
  | "expired";

/**
 * Lemon Squeezy の subscription.status を内部状態に変換する。
 * cancelled は「自動更新の停止」で ends_at までは利用可能
 * （isSubscriptionPremium が platform=web の cancelled を期限まで有効と判定する）。
 */
export function mapLemonSqueezySubscriptionStatus(
  status: unknown
): SubscriptionStatusValue {
  switch (status) {
    case "active":
      return "active";
    case "on_trial":
      return "trial";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    case "paused":
    case "past_due":
    case "unpaid":
    default:
      return "pending";
  }
}

function parseDateOrNull(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * undefined のフィールドを再帰的に取り除く。Firestore は undefined を含む
 * set を例外にするため、ペイロードの欠損フィールドで500にならないようにする。
 * Date や FieldValue（プレーンオブジェクトではない）はそのまま残す。
 */
export function stripUndefined<T>(value: T): T {
  if (!isPlainObject(value)) return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) continue;
    result[key] = stripUndefined(child);
  }
  return result as T;
}

export function toIdString(value: unknown): string | undefined {
  if (typeof value === "string" && value) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

/** Subscription オブジェクトから subscriptions/{uid} に書く内容を作る */
export function buildSubscriptionEventDocument(
  eventName: string,
  userId: string,
  data: { id?: unknown; attributes?: Record<string, unknown> } | undefined,
  serverTimestamp: () => unknown
): Record<string, unknown> {
  const attrs = data?.attributes ?? {};
  const status = mapLemonSqueezySubscriptionStatus(attrs.status);
  // 解約後は ends_at（期限）、継続中は renews_at（次回更新日）が有効期限になる
  const expiryDate =
    parseDateOrNull(attrs.ends_at) ?? parseDateOrNull(attrs.renews_at);
  const subscriptionId = toIdString(data?.id);

  return stripUndefined({
    userId,
    status,
    platform: "web",
    productId: toIdString(attrs.product_id),
    orderId: subscriptionId,
    expiryDate,
    isTrial: attrs.status === "on_trial",
    lemonSqueezyData: {
      subscriptionId,
      customerId: attrs.customer_id ?? undefined,
      variantId: attrs.variant_id ?? undefined,
      status: typeof attrs.status === "string" ? attrs.status : undefined,
      // Subscription オブジェクトの解約フラグは boolean の cancelled
      cancelled:
        typeof attrs.cancelled === "boolean" ? attrs.cancelled : undefined,
      endsAt: typeof attrs.ends_at === "string" ? attrs.ends_at : null,
      renewsAt: typeof attrs.renews_at === "string" ? attrs.renews_at : null,
      // 順不同の配送を判定するための Lemon Squeezy 側の更新時刻
      updatedAt: typeof attrs.updated_at === "string" ? attrs.updated_at : null,
      lifetime: false,
    },
    updatedAt: serverTimestamp(),
    ...(eventName === "subscription_created"
      ? { purchaseDate: serverTimestamp(), createdAt: serverTimestamp() }
      : {}),
  });
}

export interface LemonSqueezyWebhookConfig {
  /** LEMON_SQUEEZY_STORE_ID（設定時は他ストアのイベントを無視） */
  storeId?: string;
  /** 定期購入の variant（LEMON_SQUEEZY_VARIANT_ID_MONTHLY / YEARLY） */
  subscriptionVariantIds: string[];
  /** 買い切り（期限なし）の variant（LEMON_SQUEEZY_VARIANT_ID_LIFETIME）。未設定なら付与しない */
  lifetimeVariantId?: string;
  /** 本番か（本番では test_mode のイベントを無視） */
  isProduction: boolean;
}

/**
 * 環境変数から設定を読む。本番判定は Vercel の VERCEL_ENV を優先する
 * （vercel.json はプレビューでも NODE_ENV=production にするため、NODE_ENV だけだと
 * プレビューでテスト購入ができない）。VERCEL_ENV が無い環境では NODE_ENV を使う。
 */
export function readLemonSqueezyWebhookConfig(
  env: NodeJS.ProcessEnv = process.env
): LemonSqueezyWebhookConfig {
  const isProduction = env.VERCEL_ENV
    ? env.VERCEL_ENV === "production"
    : env.NODE_ENV === "production";
  return {
    storeId: env.LEMON_SQUEEZY_STORE_ID || undefined,
    subscriptionVariantIds: [
      env.LEMON_SQUEEZY_VARIANT_ID_MONTHLY,
      env.LEMON_SQUEEZY_VARIANT_ID_YEARLY,
    ].filter((value): value is string => Boolean(value)),
    lifetimeVariantId: env.LEMON_SQUEEZY_VARIANT_ID_LIFETIME || undefined,
    isProduction,
  };
}

export type WebhookPlan =
  | { kind: "write"; document: Record<string, unknown> }
  | { kind: "skip"; reason: string };

export interface WebhookPlanInput {
  eventName: string | undefined;
  userId: string;
  data: { id?: unknown; attributes?: Record<string, unknown> } | undefined;
  /** 現在の subscriptions/{uid}（無ければ undefined） */
  current: Record<string, unknown> | undefined;
  now: Date;
  serverTimestamp: () => unknown;
  config: LemonSqueezyWebhookConfig;
}

function lsData(doc: Record<string, unknown> | undefined): Record<string, unknown> {
  const value = doc?.lemonSqueezyData;
  return isPlainObject(value) ? value : {};
}

function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === "object" &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  return parseDateOrNull(value)?.toISOString() ?? null;
}

function isFullyRefunded(attrs: Record<string, unknown>): boolean {
  // Order / Subscription invoice とも、全額返金は status "refunded"（部分は "partial_refund"）
  return attrs.status === "refunded" || attrs.refunded === true;
}

/**
 * Webhook 1件を subscriptions/{uid} にどう反映するかを決める（トランザクション内で呼ぶ純粋関数）。
 *
 * 文書は1ユーザー1つなので、どのイベントでも上書きしてよいわけではない:
 * - 他ストア（store_id）・本番での test_mode・未知の variant のイベントは無視
 * - ネイティブ購入で有効な文書、買い切りで有効な文書は Web の購読イベントで上書きしない
 * - 別の購読（月額を解約して年額を購入した等）が有効な間は、古い購読の
 *   失効・解約イベントで上書きしない（新しい有効な購読への切り替えは許可）
 * - 同じ購読のイベントは attributes.updated_at が保存済みより古ければ無視（順不同の配送対策）
 * - 全額返金（subscription_payment_refunded / order_refunded）は expired にする。
 *   返金された期間が終わるまで、同じ購読のイベントで再び有効にしない
 */
export function planLemonSqueezyWebhook(input: WebhookPlanInput): WebhookPlan {
  const { eventName, userId, data, current, now, serverTimestamp, config } = input;
  const attrs = data?.attributes ?? {};

  if (!eventName) return { kind: "skip", reason: "no_event_name" };
  if (config.storeId && toIdString(attrs.store_id) !== config.storeId) {
    return { kind: "skip", reason: "other_store" };
  }
  if (config.isProduction && attrs.test_mode === true) {
    return { kind: "skip", reason: "test_mode" };
  }

  const currentLs = lsData(current);
  const currentPlatform = current?.platform;
  const currentIsNative = currentPlatform === "ios" || currentPlatform === "android";
  const currentPremium = isSubscriptionPremium(current, now);

  if (SUBSCRIPTION_OBJECT_EVENTS.has(eventName)) {
    const variantId = toIdString(attrs.variant_id);
    if (
      config.subscriptionVariantIds.length > 0 &&
      (!variantId || !config.subscriptionVariantIds.includes(variantId))
    ) {
      return { kind: "skip", reason: "unknown_variant" };
    }
    if (currentIsNative && currentPremium) {
      return { kind: "skip", reason: "native_active" };
    }
    if (currentLs.lifetime === true && currentPremium) {
      return { kind: "skip", reason: "lifetime_active" };
    }

    const document = buildSubscriptionEventDocument(
      eventName,
      userId,
      data,
      serverTimestamp
    );
    const incomingId = toIdString(data?.id);
    const currentId = toIdString(currentLs.subscriptionId);
    const sameSubscription = Boolean(currentId) && currentId === incomingId;

    if (currentId && !sameSubscription && currentPremium) {
      const incomingLive = document.status === "active" || document.status === "trial";
      const currentLive = current?.status === "active" || current?.status === "trial";
      if (!incomingLive || currentLive) {
        return { kind: "skip", reason: "other_subscription_active" };
      }
    }

    if (sameSubscription) {
      const storedUpdatedAt = parseDateOrNull(currentLs.updatedAt);
      const incomingUpdatedAt = parseDateOrNull(attrs.updated_at);
      if (
        storedUpdatedAt &&
        incomingUpdatedAt &&
        incomingUpdatedAt.getTime() < storedUpdatedAt.getTime()
      ) {
        return { kind: "skip", reason: "stale_event" };
      }
    }

    const ls = document.lemonSqueezyData as Record<string, unknown>;
    const refundedPeriodEnd = sameSubscription
      ? parseDateOrNull(currentLs.refundedPeriodEnd)
      : null;
    const incomingExpiry = document.expiryDate as Date | null | undefined;
    if (
      refundedPeriodEnd &&
      (!incomingExpiry || incomingExpiry.getTime() <= refundedPeriodEnd.getTime())
    ) {
      // 返金された期間の延長線上のイベント。返金状態を維持する
      document.status = "expired";
      ls.refundedAt = currentLs.refundedAt ?? null;
      ls.refundedPeriodEnd = currentLs.refundedPeriodEnd;
    } else {
      // 別の購読・新しい請求期間に入った購読では返金の印を消す
      ls.refundedAt = null;
      ls.refundedPeriodEnd = null;
    }
    return { kind: "write", document };
  }

  if (eventName === "subscription_payment_refunded") {
    if (!isFullyRefunded(attrs)) return { kind: "skip", reason: "partial_refund" };
    const subscriptionId = toIdString(attrs.subscription_id);
    if (
      currentIsNative ||
      !subscriptionId ||
      toIdString(currentLs.subscriptionId) !== subscriptionId
    ) {
      return { kind: "skip", reason: "refund_for_other_entitlement" };
    }
    return {
      kind: "write",
      document: {
        status: "expired",
        lemonSqueezyData: {
          refundedAt: toIsoOrNull(attrs.refunded_at) ?? now.toISOString(),
          refundedPeriodEnd: toIsoOrNull(current?.expiryDate) ?? now.toISOString(),
        },
        updatedAt: serverTimestamp(),
      },
    };
  }

  if (SUBSCRIPTION_INVOICE_EVENTS.has(eventName)) {
    return { kind: "skip", reason: "invoice_acknowledged" };
  }

  if (eventName === "order_created") {
    if (attrs.status !== "paid") return { kind: "skip", reason: "order_not_paid" };
    const firstItem = isPlainObject(attrs.first_order_item) ? attrs.first_order_item : {};
    const variantId = toIdString(firstItem.variant_id);
    // 許可リスト方式: 買い切り variant が設定され、かつ一致したときだけ期限なしで付与する
    // （定期購入のチェックアウトでも order_created は必ず送られる）
    if (!config.lifetimeVariantId || variantId !== config.lifetimeVariantId) {
      return { kind: "skip", reason: "not_lifetime_variant" };
    }
    return {
      kind: "write",
      document: stripUndefined({
        userId,
        status: "active",
        platform: "web",
        productId: toIdString(firstItem.product_id) ?? "",
        orderId: toIdString(data?.id),
        purchaseDate: serverTimestamp(),
        expiryDate: null, // 買い切りは有効期限なし
        isTrial: false,
        lemonSqueezyData: {
          orderId: toIdString(data?.id),
          customerId: attrs.customer_id ?? undefined,
          status: typeof attrs.status === "string" ? attrs.status : undefined,
          lifetime: true,
          refundedAt: null,
          refundedPeriodEnd: null,
        },
        ...(current ? {} : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      }),
    };
  }

  if (eventName === "order_refunded") {
    if (!isFullyRefunded(attrs)) return { kind: "skip", reason: "partial_refund" };
    if (
      currentLs.lifetime !== true ||
      toIdString(currentLs.orderId) !== toIdString(data?.id)
    ) {
      // 定期購入の初回注文の返金などは subscription_payment_refunded 側で扱う
      return { kind: "skip", reason: "refund_for_other_entitlement" };
    }
    return {
      kind: "write",
      document: {
        status: "expired",
        lemonSqueezyData: {
          refundedAt: toIsoOrNull(attrs.refunded_at) ?? now.toISOString(),
        },
        updatedAt: serverTimestamp(),
      },
    };
  }

  return { kind: "skip", reason: "unhandled_event" };
}

export function isUserNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "auth/user-not-found"
  );
}
