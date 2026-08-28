import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

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
const setMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("firebase-admin/firestore", () => {
  /** ウォッチリストのコレクション参照。__code を持たないことで件数読みと区別する */
  const watchlistRef = {
    doc: (code: string) => ({
      __code: code,
      delete: async () => deleteMock(code),
    }),
  };
  const tx = {
    get: async (ref: { __code?: string }) =>
      ref.__code === undefined
        ? { size: state.watchlistSize }
        : { exists: state.existingCodes.includes(ref.__code) },
    set: (ref: { __code: string }, data: unknown, options?: unknown) =>
      setMock(ref.__code, data, options),
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
      doc: () => ({ collection: () => watchlistRef }),
      runTransaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx),
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
  setMock.mockReset();
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
  });

  it("上限に達していても、既に登録済みの銘柄なら更新できる", async () => {
    state.watchlistSize = 3;
    state.existingCodes = ["7203"];
    const response = await postWatchlist({
      code: "7203",
      name: "トヨタ自動車（更新）",
    });
    expect(response.status).toBe(201);
    expect(setMock).toHaveBeenCalled();
  });

  it("既存銘柄の更新では addedAt を上書きしない", async () => {
    state.watchlistSize = 3;
    state.existingCodes = ["7203"];
    await postWatchlist({ code: "7203", name: "トヨタ自動車（更新）" });
    const [, data, options] = setMock.mock.calls[0];
    expect(data).not.toHaveProperty("addedAt");
    expect(options).toEqual({ merge: true });
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
