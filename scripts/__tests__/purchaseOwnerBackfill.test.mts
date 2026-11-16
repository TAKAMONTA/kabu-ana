import { describe, expect, it } from "vitest";
import {
  ownerKeyForSubscription,
  parseArgs,
  pickWinner,
  planBackfill,
  toMillis,
  type SubscriptionRecord,
} from "../lib/purchaseOwnerBackfill.mts";
import { purchaseOwnerKey } from "../../src/lib/purchases/purchaseOwnership.ts";

function sub(overrides: Partial<SubscriptionRecord> & { uid: string }): SubscriptionRecord {
  return {
    platform: "ios",
    productId: "com.takaapps.kabunavi.Monthly",
    orderId: "orig-1",
    purchaseToken: "tx-latest-1",
    createdAtMs: 1_000,
    purchaseDateMs: 1_000,
    ...overrides,
  };
}

describe("ownerKeyForSubscription", () => {
  it("iOS はアプリ本体と同じく originalTransactionId（orderId に保存）からキーを作る", () => {
    const key = ownerKeyForSubscription(sub({ uid: "a", orderId: "orig-1", purchaseToken: "tx-9" }));
    expect(key).toBe(
      purchaseOwnerKey({
        platform: "ios",
        productId: "x",
        purchaseToken: "tx-other",
        originalTransactionId: "orig-1",
        status: "active",
        isTrial: false,
        raw: null,
      })
    );
  });

  it("iOS で originalTransactionId が無ければ purchaseToken を使う（アプリ本体と同じ）", () => {
    const key = ownerKeyForSubscription(sub({ uid: "a", orderId: null, purchaseToken: "tx-9" }));
    expect(key).toBe(
      purchaseOwnerKey({
        platform: "ios",
        productId: "x",
        purchaseToken: "tx-9",
        status: "active",
        isTrial: false,
        raw: null,
      })
    );
  });

  it("Android は purchaseToken からキーを作り、orderId は使わない", () => {
    const a = ownerKeyForSubscription(
      sub({ uid: "a", platform: "android", orderId: "GPA.1..0", purchaseToken: "tok" })
    );
    const b = ownerKeyForSubscription(
      sub({ uid: "b", platform: "android", orderId: "GPA.1..5", purchaseToken: "tok" })
    );
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it("ネイティブ以外・識別子なしは null", () => {
    expect(ownerKeyForSubscription(sub({ uid: "a", platform: "web" }))).toBeNull();
    expect(
      ownerKeyForSubscription(sub({ uid: "a", platform: "android", purchaseToken: "" }))
    ).toBeNull();
    expect(
      ownerKeyForSubscription(sub({ uid: "a", orderId: null, purchaseToken: undefined }))
    ).toBeNull();
  });
});

describe("pickWinner", () => {
  const base = { platform: "ios" as const, productId: "p" };

  it("createdAt が最も古いアカウントを選ぶ", () => {
    expect(
      pickWinner([
        { ...base, uid: "late", createdAtMs: 300, purchaseDateMs: 1 },
        { ...base, uid: "early", createdAtMs: 100, purchaseDateMs: 999 },
      ]).uid
    ).toBe("early");
  });

  it("createdAt が同じ・不明なら purchaseDate、それも同じなら uid の辞書順", () => {
    expect(
      pickWinner([
        { ...base, uid: "b", createdAtMs: null, purchaseDateMs: 50 },
        { ...base, uid: "a", createdAtMs: null, purchaseDateMs: 60 },
      ]).uid
    ).toBe("b");
    expect(
      pickWinner([
        { ...base, uid: "b", createdAtMs: 10, purchaseDateMs: 10 },
        { ...base, uid: "a", createdAtMs: 10, purchaseDateMs: 10 },
      ]).uid
    ).toBe("a");
  });

  it("createdAt が分かるアカウントは不明なアカウントより優先する", () => {
    expect(
      pickWinner([
        { ...base, uid: "unknown", createdAtMs: null, purchaseDateMs: 1 },
        { ...base, uid: "known", createdAtMs: 9_999, purchaseDateMs: 9_999 },
      ]).uid
    ).toBe("known");
  });
});

describe("planBackfill", () => {
  const allUsers = new Set(["a", "b", "c", "d"]);

  it("所有者記録が無い購入だけ作る", () => {
    const plan = planBackfill([sub({ uid: "a" })], new Map(), allUsers);
    expect(plan.creates).toEqual([
      {
        key: ownerKeyForSubscription(sub({ uid: "a" })),
        uid: "a",
        platform: "ios",
        productId: "com.takaapps.kabunavi.Monthly",
      },
    ]);
    expect(plan.conflicts).toEqual([]);
  });

  it("同じ購入が複数アカウントにあれば最も古いアカウントに作り、他は一覧に出すだけ", () => {
    const plan = planBackfill(
      [
        sub({ uid: "b", createdAtMs: 200 }),
        sub({ uid: "a", createdAtMs: 100 }),
        sub({ uid: "c", createdAtMs: 300 }),
      ],
      new Map(),
      allUsers
    );
    expect(plan.creates.map(c => c.uid)).toEqual(["a"]);
    expect(plan.conflicts).toEqual([
      { key: plan.creates[0].key, winner: "a", losers: ["b", "c"] },
    ]);
  });

  it("既存の所有者記録は変更しない（同じ人なら記録済み、別人なら要確認）", () => {
    const same = sub({ uid: "a", orderId: "orig-same" });
    const other = sub({ uid: "b", orderId: "orig-other" });
    const plan = planBackfill(
      [same, other],
      new Map([
        [ownerKeyForSubscription(same)!, "a"],
        [ownerKeyForSubscription(other)!, "z"],
      ]),
      allUsers
    );
    expect(plan.creates).toEqual([]);
    expect(plan.alreadyOwned).toEqual([{ key: ownerKeyForSubscription(same), uid: "a" }]);
    expect(plan.ownedByOther).toEqual([
      { key: ownerKeyForSubscription(other), owner: "z", candidates: ["b"] },
    ]);
  });

  it("退会済み・Web・識別子なしは候補にしない", () => {
    const plan = planBackfill(
      [
        sub({ uid: "deleted", createdAtMs: 1 }),
        sub({ uid: "a", createdAtMs: 500 }),
        sub({ uid: "b", platform: "web" }),
        sub({ uid: "c", platform: "android", purchaseToken: "" }),
      ],
      new Map(),
      allUsers
    );
    // 退会済みの方が古くても、存在するアカウントが所有者になる
    expect(plan.creates.map(c => c.uid)).toEqual(["a"]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.skipped.map(s => s.uid).sort()).toEqual(["b", "c", "deleted"]);
  });

  it("何度実行しても同じ計画になる（入力順に依存しない）", () => {
    const subs = [
      sub({ uid: "a", orderId: "x1", createdAtMs: 5 }),
      sub({ uid: "b", orderId: "x2", createdAtMs: 5 }),
      sub({ uid: "c", orderId: "x1", createdAtMs: 5 }),
    ];
    const first = planBackfill(subs, new Map(), allUsers);
    const second = planBackfill([...subs].reverse(), new Map(), allUsers);
    expect(second).toEqual(first);
  });
});

describe("toMillis", () => {
  it("Firestore Timestamp・Date・文字列を読み、読めなければ null", () => {
    expect(toMillis({ toMillis: () => 42 })).toBe(42);
    expect(toMillis(new Date(7))).toBe(7);
    expect(toMillis("1970-01-01T00:00:01.000Z")).toBe(1000);
    expect(toMillis("not a date")).toBeNull();
    expect(toMillis(undefined)).toBeNull();
    expect(toMillis({})).toBeNull();
  });
});

describe("parseArgs", () => {
  it("既定は確認のみ。--apply で書き込み、--dry-run があれば書き込まない", () => {
    expect(parseArgs([])).toEqual({ apply: false, keyFile: null });
    expect(parseArgs(["--apply"])).toEqual({ apply: true, keyFile: null });
    expect(parseArgs(["--apply", "--dry-run"]).apply).toBe(false);
    expect(parseArgs(["--dry-run", "--apply"]).apply).toBe(false);
  });

  it("--key-file を2つの書き方で受け付け、値が無ければエラー", () => {
    expect(parseArgs(["--key-file", "k.json"]).keyFile).toBe("k.json");
    expect(parseArgs(["--key-file=k.json"]).keyFile).toBe("k.json");
    expect(() => parseArgs(["--key-file"])).toThrow();
    expect(() => parseArgs(["--unknown"])).toThrow();
  });
});
