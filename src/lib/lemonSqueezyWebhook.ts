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
    },
    updatedAt: serverTimestamp(),
    ...(eventName === "subscription_created"
      ? { purchaseDate: serverTimestamp(), createdAt: serverTimestamp() }
      : {}),
  });
}

/** 定期購入用の variant ID（設定されているもののみ） */
function subscriptionVariantIds(): Set<string> {
  return new Set(
    [
      process.env.LEMON_SQUEEZY_VARIANT_ID_MONTHLY,
      process.env.LEMON_SQUEEZY_VARIANT_ID_YEARLY,
    ].filter((value): value is string => Boolean(value))
  );
}

/**
 * order_created を一括購入（期限なし）として保存してよいかを判定する。
 * order_created は定期購入のチェックアウトでも subscription_created と一緒に
 * 必ず送られるため、定期購入 variant の注文を一括購入として扱うと
 * expiryDate=null / isTrial=false で上書きしてしまう。
 */
export function shouldGrantOneTimeOrder(
  attributes: Record<string, unknown> | undefined
): { grant: boolean; reason?: string } {
  const attrs = attributes ?? {};
  if (attrs.status !== "paid") {
    return { grant: false, reason: "order_not_paid" };
  }
  const firstItem = isPlainObject(attrs.first_order_item)
    ? attrs.first_order_item
    : {};
  const variantId = toIdString(firstItem.variant_id);
  const subscriptionVariants = subscriptionVariantIds();
  if (subscriptionVariants.size === 0) {
    // 定期購入か判定できない。期限なしのプレミアムを誤付与しないよう保存しない
    return { grant: false, reason: "subscription_variants_not_configured" };
  }
  if (!variantId || subscriptionVariants.has(variantId)) {
    return { grant: false, reason: "subscription_order" };
  }
  return { grant: true };
}

export function isUserNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "auth/user-not-found"
  );
}
