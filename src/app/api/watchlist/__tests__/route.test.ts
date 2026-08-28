import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { FREE_WATCHLIST_LIMIT } from "@/lib/watchlist/limits";

const verifyAuthMock = vi.fn();
const getAdminAppMock = vi.fn();
vi.mock("@/lib/auth/verifyAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/verifyAuth")>(
    "@/lib/auth/verifyAuth"
  );
  return {
    ...actual,
    verifyAuth: (req: unknown) => verifyAuthMock(req),
    getAdminApp: () => getAdminAppMock(),
  };
});

/** テストごとに差し替える擬似 Firestore の状態 */
const state = {
  /** ウォッチリストの登録件数 */
  watchlistSize: 0,
  /** 既に登録済みの銘柄コード */
  existingCodes: [] as string[],
  /** subscriptions/{uid} の中身。undefined なら無料 */
  subscription: undefined as Record<string, unknown> | undefined,
};
/** db.doc(path) に渡されたパス。認可境界（他人の uid を触っていないか）を固定する */
const dbDocMock = vi.fn();
/** db.doc(...).collection(name) に渡されたコレクション名 */
const subCollectionMock = vi.fn();
/** watchlist 配下のドキュメントへの tx.set */
const setMock = vi.fn();
/** users/{uid} への tx.set（直列化のための書き込み） */
const userSetMock = vi.fn();
/** 件数読み（tx.get(query)）。引数は limit 値、未指定なら null */
const queryGetMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("firebase-admin/firestore", () => {
  /**
   * 参照の種類。実物の Firestore は型で区別するが、
   * モックでは __kind で判別してそれぞれの戻り値を返す。
   */
  type MockRef =
    | { __kind: "watchlistDoc"; __code: string }
    | { __kind: "watchlistQuery"; __limit: number | null }
    | { __kind: "userDoc"; __path: string };

  const watchlistDoc = (code: string) => ({
    __kind: "watchlistDoc" as const,
    __code: code,
    delete: async () => deleteMock(code),
  });
  const watchlistQuery = (limit: number | null) => ({
    __kind: "watchlistQuery" as const,
    __limit: limit,
  });
  /** コレクション参照はそれ自体が limit 無しのクエリでもある（実物と同じ） */
  const watchlistRef = () => ({
    ...watchlistQuery(null),
    doc: watchlistDoc,
    limit: (n: number) => watchlistQuery(n),
  });

  /**
   * 実物のトランザクションは書き込み後の読み取りを例外にする。
   * モックが許してしまうと、実行時にだけ落ちる順序ミスを見逃す。
   */
  const createTransaction = () => {
    let written = false;
    return {
      get: async (ref: MockRef) => {
        if (written) {
          throw new Error("READ_AFTER_WRITE");
        }
        if (ref.__kind === "watchlistDoc") {
          return { exists: state.existingCodes.includes(ref.__code) };
        }
        if (ref.__kind === "watchlistQuery") {
          queryGetMock(ref.__limit);
          return {
            size:
              ref.__limit === null
                ? state.watchlistSize
                : Math.min(state.watchlistSize, ref.__limit),
          };
        }
        return { exists: true, data: () => ({}) };
      },
      set: (ref: MockRef, data: unknown, options?: unknown) => {
        written = true;
        if (ref.__kind === "userDoc") {
          userSetMock(ref.__path, data, options);
          return;
        }
        if (ref.__kind === "watchlistDoc") {
          setMock(ref.__code, data, options);
          return;
        }
        throw new Error("unexpected set target");
      },
    };
  };

  return {
    getFirestore: () => ({
      collection: (name: string) => {
        if (name !== "subscriptions") {
          throw new Error(`unexpected collection: ${name}`);
        }
        return {
          doc: () => ({
            get: async () => ({ data: () => state.subscription }),
          }),
        };
      },
      doc: (path: string) => {
        dbDocMock(path);
        return {
          __kind: "userDoc" as const,
          __path: path,
          collection: (name: string) => {
            subCollectionMock(name);
            return watchlistRef();
          },
        };
      },
      runTransaction: async (
        fn: (t: ReturnType<typeof createTransaction>) => Promise<void>
      ) => fn(createTransaction()),
    }),
    FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
  };
});

import { POST, DELETE } from "../route";

function postWatchlist(body: unknown) {
  const request = new NextRequest("http://localhost/api/watchlist", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: "Bearer dummy",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return POST(request);
}

function deleteWatchlist(code: string) {
  const request = new NextRequest(
    `http://localhost/api/watchlist?code=${encodeURIComponent(code)}`,
    { method: "DELETE", headers: { Authorization: "Bearer dummy" } }
  );
  return DELETE(request);
}

beforeEach(() => {
  verifyAuthMock.mockReset();
  getAdminAppMock.mockReset();
  dbDocMock.mockReset();
  subCollectionMock.mockReset();
  setMock.mockReset();
  userSetMock.mockReset();
  queryGetMock.mockReset();
  deleteMock.mockReset();
  state.watchlistSize = 0;
  state.existingCodes = [];
  state.subscription = undefined;
  verifyAuthMock.mockResolvedValue({ uid: "user-1" });
  getAdminAppMock.mockReturnValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/watchlist", () => {
  it("認証エラーはそのまま返す（503）", async () => {
    verifyAuthMock.mockResolvedValue(
      NextResponse.json(
        { error: "認証サービスが利用できません" },
        { status: 503 }
      )
    );
    const response = await postWatchlist({
      code: "7203",
      name: "トヨタ自動車",
    });
    expect(response.status).toBe(503);
  });

  it("不正な JSON は 400", async () => {
    const response = await postWatchlist("not-json");
    expect(response.status).toBe(400);
  });

  it("code が空白のみなら 400", async () => {
    const response = await postWatchlist({ code: "   ", name: "トヨタ自動車" });
    expect(response.status).toBe(400);
  });

  it("name が空白のみなら 400", async () => {
    const response = await postWatchlist({ code: "7203", name: "   " });
    expect(response.status).toBe(400);
  });

  it("無料プランで3件未満なら登録できる", async () => {
    state.watchlistSize = 2;
    const response = await postWatchlist({
      code: "7203",
      name: "トヨタ自動車",
    });
    expect(response.status).toBe(201);
    expect(setMock).toHaveBeenCalledWith(
      "7203",
      expect.objectContaining({ code: "7203", name: "トヨタ自動車" }),
      undefined
    );
  });

  it("新規登録では addedAt を書く", async () => {
    const response = await postWatchlist({
      code: "7203",
      name: "トヨタ自動車",
    });
    expect(response.status).toBe(201);
    expect(setMock.mock.calls[0][1]).toHaveProperty(
      "addedAt",
      "SERVER_TIMESTAMP"
    );
  });

  it("無料プランで3件に達していたら 403", async () => {
    state.watchlistSize = 3;
    const response = await postWatchlist({
      code: "7203",
      name: "トヨタ自動車",
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "limit_reached" });
    expect(setMock).not.toHaveBeenCalled();
    expect(userSetMock).not.toHaveBeenCalled();
  });

  it("上限に達していても、既に登録済みの銘柄なら更新できる", async () => {
    state.watchlistSize = 3;
    state.existingCodes = ["7203"];
    const response = await postWatchlist({
      code: "7203",
      name: "トヨタ自動車（更新）",
    });
    expect(response.status).toBe(200);
    expect(setMock).toHaveBeenCalled();
  });

  it("新規登録は 201、既存の更新は 200 を返す", async () => {
    const created = await postWatchlist({
      code: "7203",
      name: "トヨタ自動車",
    });
    expect(created.status).toBe(201);

    state.existingCodes = ["7203"];
    state.watchlistSize = 1;
    const updated = await postWatchlist({
      code: "7203",
      name: "トヨタ自動車（更新）",
    });
    expect(updated.status).toBe(200);
  });

  it("既存銘柄の更新では addedAt を上書きしない", async () => {
    state.watchlistSize = 3;
    state.existingCodes = ["7203"];
    await postWatchlist({ code: "7203", name: "トヨタ自動車（更新）" });
    const [, data, options] = setMock.mock.calls[0];
    expect(data).not.toHaveProperty("addedAt");
    expect(options).toEqual({ merge: true });
  });

  it("登録先パスは本人の uid・watchlist コレクションである", async () => {
    state.watchlistSize = 1;
    const response = await postWatchlist({
      code: "7203",
      name: "トヨタ自動車",
    });
    expect(response.status).toBe(201);
    // 直列化用の users/{uid} も含め、触れたドキュメントは本人のものだけ
    expect(dbDocMock).toHaveBeenCalledWith("users/user-1");
    expect(new Set(dbDocMock.mock.calls.map(([path]) => path))).toEqual(
      new Set(["users/user-1"])
    );
    expect(new Set(subCollectionMock.mock.calls.map(([name]) => name))).toEqual(
      new Set(["watchlist"])
    );
    expect(userSetMock).toHaveBeenCalledWith(
      "users/user-1",
      expect.anything(),
      { merge: true }
    );
  });

  it("無料プランの件数読みは上限件数までに絞る", async () => {
    state.watchlistSize = 2;
    await postWatchlist({ code: "7203", name: "トヨタ自動車" });
    expect(queryGetMock).toHaveBeenCalledTimes(1);
    expect(queryGetMock).toHaveBeenCalledWith(FREE_WATCHLIST_LIMIT);
  });

  it("プレミアムなら3件を超えても登録できる", async () => {
    state.subscription = { status: "active" };
    state.watchlistSize = 4;
    const response = await postWatchlist({
      code: "7203",
      name: "トヨタ自動車",
    });
    expect(response.status).toBe(201);
    expect(setMock).toHaveBeenCalled();
  });

  it("プレミアムでは件数の読み取りを行わない", async () => {
    state.subscription = { status: "active" };
    state.watchlistSize = 500;
    const response = await postWatchlist({
      code: "7203",
      name: "トヨタ自動車",
    });
    expect(response.status).toBe(201);
    expect(queryGetMock).not.toHaveBeenCalled();
    expect(userSetMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/watchlist", () => {
  it("code を指定して削除できる", async () => {
    const response = await deleteWatchlist("7203");
    expect(response.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith("7203");
  });

  it("code が無ければ 400", async () => {
    const request = new NextRequest("http://localhost/api/watchlist", {
      method: "DELETE",
      headers: { Authorization: "Bearer dummy" },
    });
    const response = await DELETE(request);
    expect(response.status).toBe(400);
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
