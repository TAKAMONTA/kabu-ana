import crypto from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { VerifiedNativePurchase } from "./nativePurchaseVerification";

/**
 * ネイティブ購入（App Store / Google Play）の「所有者」を記録するコレクション。
 * ドキュメントIDはストア側の不変な購入IDのハッシュ、値は所有する Firebase uid。
 *
 * 検証済みの購入でも、誰のアカウントに紐づくかはストア応答だけでは決まらない。
 * 所有者を記録しないと、1回の購入の識別子を別アカウントから送るだけで
 * 何アカウントでもプレミアムにできてしまうため、最初に登録したアカウントに固定する。
 * 退会時（/api/user/delete）にそのアカウントの所有記録を解放する。
 *
 * Firestore ルールではどの match にも該当しないため、クライアントからは
 * 読み書きできない（Admin SDK 専用）。
 */
export const PURCHASE_OWNERS_COLLECTION = "purchase_owners";

export const PURCHASE_OWNED_BY_OTHER_MESSAGE =
  "この購入は別のアカウントで使用されています。購入時にログインしていたアカウントでログインしてください。";

/** 購入が別アカウントの所有だったことを表すエラー（HTTP 409 に対応） */
export class PurchaseOwnedByOtherAccountError extends Error {
  readonly statusCode = 409;
  constructor() {
    super(PURCHASE_OWNED_BY_OTHER_MESSAGE);
    this.name = "PurchaseOwnedByOtherAccountError";
  }
}

/**
 * ストアをまたいで一意・更新をまたいで不変な購入キーを返す。
 * - iOS: originalTransactionId（自動更新しても変わらない）。無ければ transactionId
 * - Android: purchaseToken（定期購入の更新では変わらない。orderId は更新ごとに
 *   末尾の連番が変わるため使わない）
 * 生の識別子は保存せず、SHA-256 をドキュメントIDに使う（"/" などを含み得るため）。
 */
export function purchaseOwnerKey(verified: VerifiedNativePurchase): string {
  const stableId =
    verified.platform === "ios"
      ? verified.originalTransactionId || verified.purchaseToken
      : verified.purchaseToken;
  return crypto
    .createHash("sha256")
    .update(`${verified.platform}:${stableId}`)
    .digest("hex");
}

/**
 * 購入の所有者を確認し、問題なければ subscriptions/{uid} への書き込みと
 * 所有記録を1トランザクションで行う（同時に別アカウントから送られても
 * 片方しか成立しない）。
 *
 * @param buildSubscriptionData 既存の subscriptions/{uid} が存在するかを受け取り、
 *   書き込むデータを返す（createdAt の付与判定に使う）
 * @throws PurchaseOwnedByOtherAccountError 別アカウントが所有している場合
 */
export async function writeSubscriptionWithOwnership(
  db: Firestore,
  uid: string,
  verified: VerifiedNativePurchase,
  buildSubscriptionData: (subscriptionExists: boolean) => Record<string, unknown>,
  serverTimestamp: () => unknown,
  ownerStillExists: (ownerUid: string) => Promise<boolean>
): Promise<Record<string, unknown>> {
  const ownerRef = db
    .collection(PURCHASE_OWNERS_COLLECTION)
    .doc(purchaseOwnerKey(verified));
  const subscriptionRef = db.collection("subscriptions").doc(uid);

  return db.runTransaction(async tx => {
    // 読み取りは書き込みより前にまとめる（Firestore トランザクションの制約）
    const [ownerSnap, subscriptionSnap] = await Promise.all([
      tx.get(ownerRef),
      tx.get(subscriptionRef),
    ]);
    const ownerUid = ownerSnap.exists ? ownerSnap.data()?.uid : undefined;
    let takeOver = !ownerSnap.exists;
    if (typeof ownerUid === "string" && ownerUid !== uid) {
      // 所有者が退会済み（Auth に存在しない）なら引き継ぐ。退会処理の解放が漏れた・
      // 退会直後に古い ID トークンで所有記録が作り直された、のどちらでも
      // 同じ Apple ID / Google アカウントで再登録した人が永久に 409 にならないように
      if (await ownerStillExists(ownerUid)) {
        throw new PurchaseOwnedByOtherAccountError();
      }
      takeOver = true;
    }

    const subscriptionData = buildSubscriptionData(subscriptionSnap.exists);
    tx.set(subscriptionRef, subscriptionData, { merge: true });
    tx.set(
      ownerRef,
      !takeOver
        ? { updatedAt: serverTimestamp() }
        : {
            uid,
            platform: verified.platform,
            productId: verified.productId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
      // 引き継ぎ時は前の所有者の値を残さない
      { merge: !takeOver }
    );
    return subscriptionData;
  });
}

/**
 * Firebase Auth にユーザーが存在するかを返す（所有者の生存確認用）。
 * 存在しない（auth/user-not-found）ときだけ false。それ以外の失敗は投げる
 * （判定できないまま所有権を移さない）。
 */
export function authUserExists(auth: {
  getUser: (uid: string) => Promise<unknown>;
}): (uid: string) => Promise<boolean> {
  return async (uid: string) => {
    try {
      await auth.getUser(uid);
      return true;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        (error as { code?: unknown }).code === "auth/user-not-found"
      ) {
        return false;
      }
      throw error;
    }
  };
}

/**
 * 退会時に、そのアカウントが所有していた購入記録を解放する。
 * uid の等価条件1つだけなので複合インデックスは不要。
 */
export async function releasePurchaseOwnership(
  db: Firestore,
  uid: string
): Promise<number> {
  const snapshot = await db
    .collection(PURCHASE_OWNERS_COLLECTION)
    .where("uid", "==", uid)
    .get();
  await Promise.all(snapshot.docs.map(doc => doc.ref.delete()));
  return snapshot.size;
}
