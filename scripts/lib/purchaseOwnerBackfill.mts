/**
 * 既存のネイティブ購読（subscriptions/{uid}）から purchase_owners の所有者記録を
 * 作るための純粋なロジック（Firestore に触れない部分）。
 * 実行は scripts/backfill-purchase-owners.mts から行う。
 *
 * 所有者キーの計算はアプリ本体と同じ purchaseOwnerKey を使う（重複実装しない）。
 */
import { purchaseOwnerKey } from "../../src/lib/purchases/purchaseOwnership.ts";

export type NativePlatform = "ios" | "android";

/** subscriptions/{uid} から必要な項目だけを取り出したもの */
export interface SubscriptionRecord {
  uid: string;
  platform: unknown;
  productId: unknown;
  /** iOS では originalTransactionId が保存されている（buildSubscriptionDocumentFromVerification） */
  orderId: unknown;
  purchaseToken: unknown;
  /** ミリ秒。不明なら null */
  createdAtMs: number | null;
  purchaseDateMs: number | null;
}

export interface OwnerCandidate {
  uid: string;
  platform: NativePlatform;
  productId: string;
  createdAtMs: number | null;
  purchaseDateMs: number | null;
}

export interface BackfillPlan {
  /** 新しく作る所有者記録 */
  creates: Array<{ key: string; uid: string; platform: NativePlatform; productId: string }>;
  /** 同じ購入が複数アカウントにあった（勝者に記録を作り、敗者は変更しない） */
  conflicts: Array<{ key: string; winner: string; losers: string[] }>;
  /** すでに同じアカウントの所有記録がある（何もしない） */
  alreadyOwned: Array<{ key: string; uid: string }>;
  /** すでに別アカウントの所有記録がある（何もしない・要確認） */
  ownedByOther: Array<{ key: string; owner: string; candidates: string[] }>;
  /** 対象外にした購読 */
  skipped: Array<{ uid: string; reason: string }>;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * 購読ドキュメントから所有者キーを計算する。ネイティブ以外・識別子なしは null。
 * アプリ本体（purchaseOwnerKey）と同じ規則:
 * - iOS: originalTransactionId（保存先は orderId）、無ければ purchaseToken
 * - Android: purchaseToken
 */
export function ownerKeyForSubscription(sub: SubscriptionRecord): string | null {
  if (sub.platform !== "ios" && sub.platform !== "android") return null;
  const purchaseToken = nonEmptyString(sub.purchaseToken);
  if (sub.platform === "android") {
    if (!purchaseToken) return null;
    return purchaseOwnerKey({
      platform: "android",
      productId: "",
      purchaseToken,
      status: "active",
      isTrial: false,
      raw: null,
    });
  }
  const originalTransactionId = nonEmptyString(sub.orderId);
  if (!originalTransactionId && !purchaseToken) return null;
  return purchaseOwnerKey({
    platform: "ios",
    productId: "",
    purchaseToken: purchaseToken ?? "",
    originalTransactionId: originalTransactionId ?? undefined,
    status: "active",
    isTrial: false,
    raw: null,
  });
}

function sortKey(value: number | null): number {
  return value === null || !Number.isFinite(value) ? Number.POSITIVE_INFINITY : value;
}

/**
 * 同じ購入を持つ候補から所有者を1人選ぶ。
 * createdAt が最も古い人 → 同じなら purchaseDate が古い人 → 同じなら uid の辞書順。
 * （毎回同じ結果になるよう、最後は uid で決める）
 */
export function pickWinner(candidates: OwnerCandidate[]): OwnerCandidate {
  if (candidates.length === 0) throw new Error("候補がありません");
  return [...candidates].sort(
    (a, b) =>
      sortKey(a.createdAtMs) - sortKey(b.createdAtMs) ||
      sortKey(a.purchaseDateMs) - sortKey(b.purchaseDateMs) ||
      (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)
  )[0];
}

/**
 * 一括作成の計画を立てる（書き込みはしない）。
 * @param subscriptions ネイティブ購読の一覧
 * @param existingOwners 既存の所有者記録（キー → uid）
 * @param existingAuthUids Firebase Auth に存在する uid（退会済みは候補にしない）
 */
export function planBackfill(
  subscriptions: SubscriptionRecord[],
  existingOwners: Map<string, string>,
  existingAuthUids: Set<string>
): BackfillPlan {
  const plan: BackfillPlan = {
    creates: [],
    conflicts: [],
    alreadyOwned: [],
    ownedByOther: [],
    skipped: [],
  };
  const groups = new Map<string, OwnerCandidate[]>();

  for (const sub of subscriptions) {
    if (sub.platform !== "ios" && sub.platform !== "android") {
      plan.skipped.push({ uid: sub.uid, reason: "ネイティブ購入ではない" });
      continue;
    }
    const key = ownerKeyForSubscription(sub);
    if (!key) {
      plan.skipped.push({ uid: sub.uid, reason: "購入IDが保存されていない" });
      continue;
    }
    if (!existingAuthUids.has(sub.uid)) {
      plan.skipped.push({ uid: sub.uid, reason: "アカウントが存在しない（退会済み）" });
      continue;
    }
    const candidate: OwnerCandidate = {
      uid: sub.uid,
      platform: sub.platform,
      productId: nonEmptyString(sub.productId) ?? "",
      createdAtMs: sub.createdAtMs,
      purchaseDateMs: sub.purchaseDateMs,
    };
    const group = groups.get(key);
    if (group) group.push(candidate);
    else groups.set(key, [candidate]);
  }

  // 出力順を安定させる
  for (const key of [...groups.keys()].sort()) {
    const candidates = groups.get(key)!;
    const uids = candidates.map(c => c.uid).sort();
    const existingOwner = existingOwners.get(key);

    if (existingOwner !== undefined) {
      if (uids.includes(existingOwner)) {
        plan.alreadyOwned.push({ key, uid: existingOwner });
      } else {
        plan.ownedByOther.push({ key, owner: existingOwner, candidates: uids });
      }
      continue;
    }

    const winner = pickWinner(candidates);
    plan.creates.push({
      key,
      uid: winner.uid,
      platform: winner.platform,
      productId: winner.productId,
    });
    if (candidates.length > 1) {
      plan.conflicts.push({
        key,
        winner: winner.uid,
        losers: uids.filter(uid => uid !== winner.uid),
      });
    }
  }

  return plan;
}

/** Firestore の Timestamp / Date / ISO 文字列 / 数値をミリ秒にする。読めなければ null */
export function toMillis(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === "object" && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    const ms = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === "string" || typeof value === "number") {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/** コマンドライン引数を解釈する */
export function parseArgs(argv: string[]): { apply: boolean; keyFile: string | null } {
  let apply = false;
  let keyFile: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") apply = true;
    else if (arg === "--dry-run") apply = false;
    else if (arg === "--key-file") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) throw new Error("--key-file の後にファイルのパスを指定してください");
      keyFile = next;
      i++;
    } else if (arg.startsWith("--key-file=")) {
      keyFile = arg.slice("--key-file=".length) || null;
    } else {
      throw new Error(`不明な引数です: ${arg}`);
    }
  }
  // --dry-run と --apply が両方あれば、後に書いた方ではなく「書き込まない」を優先する
  if (argv.includes("--dry-run")) apply = false;
  return { apply, keyFile };
}
