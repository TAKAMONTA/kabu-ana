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

const getStockDataMock = vi.fn();
const getCompanyNewsMock = vi.fn();
vi.mock("@/lib/api/marketDataClient", () => ({
  createMarketDataClient: () => ({
    getStockData: getStockDataMock,
    getCompanyNews: getCompanyNewsMock,
  }),
}));

const axiosPostMock = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...a: unknown[]) => axiosPostMock(...a) },
}));

vi.mock("@/lib/api/openrouter", () => ({
  OpenRouterClient: class {
    baseURL = "https://openrouter.test/api/v1";
    apiKey = "test-key";
  },
}));

/** 擬似 Firestore の状態 */
const state = {
  digestDoc: undefined as Record<string, unknown> | undefined,
  /** トランザクション内の読み取りを失敗させる（取得前の障害の再現） */
  txGetThrows: false,
  watchlistDocs: [] as Array<{ code: string; name: string }>,
};
const setMock = vi.fn();
const txSetMock = vi.fn();
const deleteMock = vi.fn();
const docPathMock = vi.fn();

/**
 * 実 Firestore SDK は undefined 値の書き込みを拒否して throw する。
 * その挙動をモックでも再現し、undefined の混入を回帰として検出する。
 */
function assertNoUndefined(data: unknown, path = ""): void {
  if (data === undefined) {
    throw new Error(
      `Cannot use "undefined" as a Firestore value (field: ${path || "root"})`
    );
  }
  if (Array.isArray(data)) {
    data.forEach((v, i) => assertNoUndefined(v, `${path}[${i}]`));
    return;
  }
  if (data !== null && typeof data === "object") {
    // Timestamp 等のクラスインスタンスは走査しない（プレーンな値のみ）
    if (Object.getPrototypeOf(data) !== Object.prototype) return;
    for (const [key, value] of Object.entries(data)) {
      assertNoUndefined(value, path ? `${path}.${key}` : key);
    }
  }
}

/**
 * 実 Firestore は同一ドキュメントに競合したトランザクションを直列化し、
 * 負けた側を再実行する。モックでは実行を直列化することでそれを再現する。
 */
let txChain: Promise<unknown> = Promise.resolve();

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const tx = {
        get: async (_ref: unknown) => {
          if (state.txGetThrows) throw new Error("transaction get failed");
          return { data: () => state.digestDoc };
        },
        set: (ref: { __id?: string } | undefined, data: unknown) => {
          assertNoUndefined(data);
          state.digestDoc = data as Record<string, unknown>;
          txSetMock(ref?.__id, data);
        },
      };
      const run = txChain.then(() => fn(tx));
      txChain = run.catch(() => undefined);
      return run;
    },
    doc: (path: string) => {
      docPathMock(path);
      return {
        collection: (name: string) => {
          if (name === "watchlist") {
            return {
              orderBy: () => ({
                limit: () => ({
                  get: async () => ({
                    empty: state.watchlistDocs.length === 0,
                    docs: state.watchlistDocs.map(d => ({
                      id: d.code,
                      data: () => d,
                    })),
                  }),
                }),
              }),
            };
          }
          if (name === "digests") {
            return {
              doc: (id: string) => ({
                __id: id,
                get: async () => ({ data: () => state.digestDoc }),
                set: async (data: unknown) => {
                  assertNoUndefined(data);
                  state.digestDoc = data as Record<string, unknown>;
                  setMock(id, data);
                },
                delete: async () => {
                  state.digestDoc = undefined;
                  deleteMock(id);
                },
              }),
            };
          }
          throw new Error(`unexpected collection: ${name}`);
        },
      };
    },
  }),
  // 書き込み時のセンチネルと読み戻し時の Timestamp を1つのモックで兼ねる
  FieldValue: { serverTimestamp: () => ({ toMillis: () => Date.now() }) },
}));

import { GET } from "../route";

function getDigest(retry = false) {
  const request = new NextRequest(
    `http://localhost/api/digest${retry ? "?retry=1" : ""}`,
    { method: "GET", headers: { Authorization: "Bearer dummy" } }
  );
  return GET(request);
}

const okAi = (json: unknown) => ({
  data: { choices: [{ message: { content: JSON.stringify(json) } }] },
});
const validAi = {
  marketLine: "全体は小幅高。",
  stockLines: [{ code: "7203", line: "前日比+1.3%。" }],
  focusLine: "決算週。",
};

const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "test-key";
  verifyAuthMock.mockReset();
  getAdminAppMock.mockReset();
  getStockDataMock.mockReset();
  getCompanyNewsMock.mockReset();
  axiosPostMock.mockReset();
  setMock.mockReset();
  txSetMock.mockReset();
  deleteMock.mockReset();
  docPathMock.mockReset();
  txChain = Promise.resolve();
  state.digestDoc = undefined;
  state.txGetThrows = false;
  state.watchlistDocs = [{ code: "7203", name: "トヨタ自動車" }];
  verifyAuthMock.mockResolvedValue({ uid: "user-1" });
  getAdminAppMock.mockReturnValue({});
  getStockDataMock.mockResolvedValue({
    price: 3156,
    changePercent: 1.28,
    asOf: "2026-08-31",
  });
  getCompanyNewsMock.mockResolvedValue([{ title: "自動運転の報道" }]);
  axiosPostMock.mockResolvedValue(okAi(validAi));
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
});

describe("GET /api/digest", () => {
  it("認証エラーはそのまま返し、AIも外部APIも呼ばない", async () => {
    verifyAuthMock.mockResolvedValue(
      NextResponse.json(
        { error: "認証サービスが利用できません" },
        { status: 503 }
      )
    );
    const res = await getDigest();
    expect(res.status).toBe(503);
    expect(axiosPostMock).not.toHaveBeenCalled();
    expect(getStockDataMock).not.toHaveBeenCalled();
  });

  it("ready のキャッシュがあればそのまま返し、AIを呼ばない", async () => {
    state.digestDoc = {
      status: "ready",
      dateId: "2026-09-02",
      marketLine: "保存済み。",
      stockLines: [{ code: "7203", name: "トヨタ自動車", line: "x" }],
      focusLine: "y",
      codes: ["7203"],
      asOf: "2026-08-31",
    };
    const body = await (await getDigest()).json();
    expect(body.status).toBe("ready");
    expect(body.marketLine).toBe("保存済み。");
    expect(axiosPostMock).not.toHaveBeenCalled();
  });

  it("generating（2分以内）は generating を返し、AIを呼ばない", async () => {
    state.digestDoc = {
      status: "generating",
      createdAt: { toMillis: () => Date.now() - 30_000 },
    };
    const body = await (await getDigest()).json();
    expect(body.status).toBe("generating");
    expect(axiosPostMock).not.toHaveBeenCalled();
  });

  it("generating が2分超なら作り直す", async () => {
    state.digestDoc = {
      status: "generating",
      createdAt: { toMillis: () => Date.now() - 3 * 60 * 1000 },
    };
    const body = await (await getDigest()).json();
    expect(body.status).toBe("ready");
    expect(axiosPostMock).toHaveBeenCalledTimes(1);
  });

  it("同時オープンでもAIは1回だけ。負けた側は generating を返す", async () => {
    const [resA, resB] = await Promise.all([getDigest(), getDigest()]);
    const statuses = [
      (await resA.json()).status,
      (await resB.json()).status,
    ].sort();
    expect(statuses).toEqual(["generating", "ready"]);
    expect(axiosPostMock).toHaveBeenCalledTimes(1);
  });

  it("ウォッチリスト0件は empty を返し、作りかけの doc を消す", async () => {
    state.watchlistDocs = [];
    const body = await (await getDigest()).json();
    expect(body.status).toBe("empty");
    expect(deleteMock).toHaveBeenCalled();
    expect(axiosPostMock).not.toHaveBeenCalled();
  });

  it("正常生成: ready を保存して返す（AI 1回・銘柄名がマージされる）", async () => {
    const body = await (await getDigest()).json();
    expect(body.status).toBe("ready");
    expect(body.stockLines[0]).toEqual({
      code: "7203",
      name: "トヨタ自動車",
      line: "前日比+1.3%。",
    });
    expect(body.asOf).toBe("2026-08-31");
    expect(axiosPostMock).toHaveBeenCalledTimes(1);
    expect(setMock).toHaveBeenCalledWith(
      body.dateId,
      expect.objectContaining({ status: "ready" })
    );
  });

  it("保存先パスは本人の users/{uid} 配下である", async () => {
    await getDigest();
    expect(docPathMock).toHaveBeenCalledWith("users/user-1");
  });

  it("一部銘柄のデータ失敗でも生成は続行する", async () => {
    state.watchlistDocs = [
      { code: "7203", name: "トヨタ自動車" },
      { code: "9984", name: "ソフトバンクグループ" },
    ];
    getStockDataMock.mockImplementation(async (code: string) =>
      code === "7203"
        ? { price: 3156, changePercent: 1.28, asOf: "2026-08-31" }
        : null
    );
    getCompanyNewsMock.mockResolvedValue([]);
    const body = await (await getDigest()).json();
    expect(body.status).toBe("ready");
    expect(axiosPostMock).toHaveBeenCalledTimes(1);
  });

  it("AI応答が不正JSONなら error を保存して返す", async () => {
    axiosPostMock.mockResolvedValue({
      data: { choices: [{ message: { content: "すみません、できません" } }] },
    });
    const body = await (await getDigest()).json();
    expect(body.status).toBe("error");
    expect(setMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: "error" })
    );
  });

  it("error 保存済みで retry なしなら error を返し、AIを呼ばない", async () => {
    state.digestDoc = { status: "error" };
    const body = await (await getDigest()).json();
    expect(body.status).toBe("error");
    expect(axiosPostMock).not.toHaveBeenCalled();
  });

  it("error 保存済みでも retry=1 なら作り直す", async () => {
    state.digestDoc = { status: "error" };
    const body = await (await getDigest(true)).json();
    expect(body.status).toBe("ready");
    expect(axiosPostMock).toHaveBeenCalledTimes(1);
  });

  it("株価が全滅でもニュースがあれば ready。保存に asOf を含めない", async () => {
    getStockDataMock.mockResolvedValue(null);
    getCompanyNewsMock.mockResolvedValue([{ title: "新工場の稼働を発表" }]);
    const body = await (await getDigest()).json();
    expect(body.status).toBe("ready");
    expect(body).not.toHaveProperty("asOf");
    expect(setMock).toHaveBeenCalledTimes(1);
    const saved = setMock.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(saved)).not.toContain("asOf");
    expect(saved.status).toBe("ready");
  });

  it("株価もニュースも全滅ならAIを呼ばず error", async () => {
    getStockDataMock.mockResolvedValue(null);
    getCompanyNewsMock.mockResolvedValue([]);
    const body = await (await getDigest()).json();
    expect(body.status).toBe("error");
    expect(axiosPostMock).not.toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: "error", attempts: 1 })
    );
  });

  it("試行が上限(3)に達していれば retry=1 でもAIを呼ばず error", async () => {
    state.digestDoc = { status: "error", attempts: 3 };
    const body = await (await getDigest(true)).json();
    expect(body.status).toBe("error");
    expect(axiosPostMock).not.toHaveBeenCalled();
    expect(txSetMock).not.toHaveBeenCalled();
    expect(setMock).not.toHaveBeenCalled();
  });

  it("取得前の読み取り失敗では既存の ready を error で上書きしない", async () => {
    const readyDoc = {
      status: "ready",
      dateId: "2026-09-02",
      marketLine: "保存済み。",
      stockLines: [{ code: "7203", name: "トヨタ自動車", line: "x" }],
      focusLine: "y",
      codes: ["7203"],
    };
    state.digestDoc = { ...readyDoc };
    state.txGetThrows = true;
    const body = await (await getDigest()).json();
    expect(body.status).toBe("error");
    expect(setMock).not.toHaveBeenCalled();
    expect(txSetMock).not.toHaveBeenCalled();
    expect(state.digestDoc).toEqual(readyDoc);
    expect(axiosPostMock).not.toHaveBeenCalled();
  });

  it("AIが返した未知のコードは捨て、欠けた銘柄は代替文で補う", async () => {
    state.watchlistDocs = [
      { code: "7203", name: "トヨタ自動車" },
      { code: "9984", name: "ソフトバンクグループ" },
    ];
    axiosPostMock.mockResolvedValue(
      okAi({
        marketLine: "全体は小幅高。",
        stockLines: [
          { code: "0000", line: "存在しない銘柄の行。" },
          { code: "7203", line: "前日比+1.3%。" },
        ],
        focusLine: "決算週。",
      })
    );
    const body = await (await getDigest()).json();
    expect(body.status).toBe("ready");
    expect(body.stockLines).toEqual([
      { code: "7203", name: "トヨタ自動車", line: "前日比+1.3%。" },
      {
        code: "9984",
        name: "ソフトバンクグループ",
        line: "この銘柄の要約を生成できませんでした",
      },
    ]);
  });

  it("AIの行が1件も対象銘柄に一致しなければ error", async () => {
    axiosPostMock.mockResolvedValue(
      okAi({
        marketLine: "全体は小幅高。",
        stockLines: [{ code: "0000", line: "存在しない銘柄の行。" }],
        focusLine: "決算週。",
      })
    );
    const body = await (await getDigest()).json();
    expect(body.status).toBe("error");
    expect(setMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: "error" })
    );
  });
});
