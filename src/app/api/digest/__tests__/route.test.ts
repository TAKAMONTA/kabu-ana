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
  createThrows: false,
  watchlistDocs: [] as Array<{ code: string; name: string }>,
};
const setMock = vi.fn();
const createMock = vi.fn();
const deleteMock = vi.fn();
const docPathMock = vi.fn();

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
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
                set: async (data: unknown) => setMock(id, data),
                create: async (data: unknown) => {
                  if (state.createThrows) throw new Error("already exists");
                  createMock(id, data);
                },
                delete: async () => deleteMock(id),
              }),
            };
          }
          throw new Error(`unexpected collection: ${name}`);
        },
      };
    },
  }),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
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
  createMock.mockReset();
  deleteMock.mockReset();
  docPathMock.mockReset();
  state.digestDoc = undefined;
  state.createThrows = false;
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

  it("create の衝突（同時オープン）は generating を返す", async () => {
    state.createThrows = true;
    const body = await (await getDigest()).json();
    expect(body.status).toBe("generating");
    expect(axiosPostMock).not.toHaveBeenCalled();
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
});
