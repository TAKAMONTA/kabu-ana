#!/usr/bin/env node
/**
 * 既存のネイティブ購読者の「購入の所有者」記録（purchase_owners）を一括で作る（1回限り）。
 *
 * 背景:
 *   「1つの購入は1アカウントだけ」の仕組み（PR #39）より前に購入した人は所有者記録がなく、
 *   最初に更新・復元したアカウントが所有者になってしまう。これを、もともと購入していた
 *   アカウント（subscriptions/{uid} の createdAt が最も古い人）に固定する。
 *
 * 動作:
 *   - subscriptions のうち platform が ios / android のものを読む
 *   - アプリ本体と同じ規則で所有者キーを計算する
 *     （iOS: originalTransactionId、Android: purchaseToken）
 *   - 所有者記録がまだ無い購入にだけ作る。既存の記録は変更しない
 *   - 同じ購入が複数アカウントにある場合は createdAt が最も古いアカウントを所有者にし、
 *     他のアカウントは変更せず一覧に表示する
 *   - 退会済み（Firebase Auth に存在しない）アカウントは候補にしない
 *   - 何度実行しても同じ結果になる（作成はトランザクションで「無ければ作る」）
 *
 * 使い方（Node.js 22.18 以上。リポジトリの直下で実行）:
 *   1. まず確認だけ（書き込まない。既定の動作）:
 *        npm run backfill:purchase-owners -- --key-file C:\path\to\service-account.json
 *   2. 内容を確認してから書き込む:
 *        npm run backfill:purchase-owners -- --key-file C:\path\to\service-account.json --apply
 *
 *   --key-file を省くと環境変数 FIREBASE_SERVICE_ACCOUNT_KEY（JSON文字列）を使う。
 *   サービスアカウントの JSON は Firebase コンソール →「プロジェクトの設定」→
 *   「サービス アカウント」→「新しい秘密鍵の生成」で取得できる。リポジトリには置かないこと。
 */
import fs from "node:fs";
import process from "node:process";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  parseArgs,
  planBackfill,
  toMillis,
  type SubscriptionRecord,
} from "./lib/purchaseOwnerBackfill.mts";
import { PURCHASE_OWNERS_COLLECTION } from "../src/lib/purchases/purchaseOwnership.ts";

function loadServiceAccount(keyFile: string | null): object {
  const raw = keyFile
    ? fs.readFileSync(keyFile, "utf8")
    : process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      "サービスアカウントが指定されていません。--key-file でJSONファイルを指定するか、FIREBASE_SERVICE_ACCOUNT_KEY を設定してください"
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("サービスアカウントのJSONを読み取れませんでした（形式を確認してください）");
  }
}

async function main() {
  const { apply, keyFile } = parseArgs(process.argv.slice(2));
  const app = initializeApp({ credential: cert(loadServiceAccount(keyFile)) });
  const db = getFirestore(app);
  const auth = getAuth(app);

  console.log(apply ? "モード: 書き込みあり（--apply）" : "モード: 確認のみ（書き込みません）");

  // 1. ネイティブ購読を読む
  const snapshot = await db
    .collection("subscriptions")
    .where("platform", "in", ["ios", "android"])
    .get();
  const subscriptions: SubscriptionRecord[] = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      uid: doc.id,
      platform: data.platform,
      productId: data.productId,
      orderId: data.orderId,
      purchaseToken: data.purchaseToken,
      createdAtMs: toMillis(data.createdAt),
      purchaseDateMs: toMillis(data.purchaseDate),
    };
  });
  console.log(`ネイティブ購読: ${subscriptions.length} 件`);

  // 2. Firebase Auth に存在する uid を調べる（100件ずつ）
  const uids = [...new Set(subscriptions.map(s => s.uid))];
  const existingAuthUids = new Set<string>();
  for (let i = 0; i < uids.length; i += 100) {
    const result = await auth.getUsers(uids.slice(i, i + 100).map(uid => ({ uid })));
    for (const user of result.users) existingAuthUids.add(user.uid);
  }

  // 3. 既存の所有者記録を読む
  const ownerSnapshot = await db.collection(PURCHASE_OWNERS_COLLECTION).get();
  const existingOwners = new Map<string, string>();
  for (const doc of ownerSnapshot.docs) {
    const uid = doc.data().uid;
    if (typeof uid === "string") existingOwners.set(doc.id, uid);
  }
  console.log(`既存の所有者記録: ${existingOwners.size} 件`);

  // 4. 計画を立てて表示する
  const plan = planBackfill(subscriptions, existingOwners, existingAuthUids);
  const short = (key: string) => key.slice(0, 12);

  console.log(`\n作成する所有者記録: ${plan.creates.length} 件`);
  for (const c of plan.creates) {
    console.log(`  + ${short(c.key)}… → ${c.uid}（${c.platform} ${c.productId}）`);
  }
  console.log(`\n同じ購入が複数アカウントにあったもの: ${plan.conflicts.length} 件（敗者側は変更しません。必要なら個別に対応してください）`);
  for (const c of plan.conflicts) {
    console.log(`  ! ${short(c.key)}… 所有者=${c.winner} / 他のアカウント=${c.losers.join(", ")}`);
  }
  console.log(`\nすでに別アカウントの所有記録があるもの: ${plan.ownedByOther.length} 件（変更しません）`);
  for (const o of plan.ownedByOther) {
    console.log(`  ? ${short(o.key)}… 記録上の所有者=${o.owner} / 購読があるアカウント=${o.candidates.join(", ")}`);
  }
  console.log(`\nすでに正しく記録済み: ${plan.alreadyOwned.length} 件`);
  console.log(`対象外: ${plan.skipped.length} 件`);
  for (const s of plan.skipped) console.log(`  - ${s.uid}: ${s.reason}`);

  if (!apply) {
    console.log("\n確認のみのため書き込んでいません。内容に問題がなければ --apply を付けて再実行してください。");
    return;
  }

  // 5. 書き込む（無ければ作る。実行中にアプリ側で作られていたら触らない）
  let created = 0;
  let raced = 0;
  for (const c of plan.creates) {
    const ref = db.collection(PURCHASE_OWNERS_COLLECTION).doc(c.key);
    const didCreate = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (snap.exists) return false;
      tx.set(ref, {
        uid: c.uid,
        platform: c.platform,
        productId: c.productId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        backfilledAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (didCreate) created++;
    else raced++;
  }
  console.log(`\n書き込み完了: 作成 ${created} 件 / 実行中に作られていたため変更なし ${raced} 件`);
}

main().catch(error => {
  console.error(`失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
