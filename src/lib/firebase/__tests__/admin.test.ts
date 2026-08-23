import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAppsMock = vi.fn();
const initializeAppMock = vi.fn();
const certMock = vi.fn((account: unknown) => account);

vi.mock("firebase-admin/app", () => ({
  getApps: () => getAppsMock(),
  initializeApp: (options: unknown) => initializeAppMock(options),
  cert: (account: unknown) => certMock(account),
}));

// admin.tsはモジュール内でシングルトンをキャッシュするため、テストごとに
// resetModules + 動的importでクリーンな状態から読み直す。
async function loadAdminModule() {
  vi.resetModules();
  return import("../admin");
}

describe("src/lib/firebase/admin", () => {
  const originalEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    } else {
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY = originalEnv;
    }
  });

  it("throws FirebaseAdminConfigError when FIREBASE_SERVICE_ACCOUNT_KEY is not set", async () => {
    getAppsMock.mockReturnValue([]);
    const { getAdminApp, FirebaseAdminConfigError } = await loadAdminModule();

    expect(() => getAdminApp()).toThrow(FirebaseAdminConfigError);
    expect(() => getAdminApp()).toThrow(
      "FIREBASE_SERVICE_ACCOUNT_KEY が設定されていません"
    );
  });

  it("throws FirebaseAdminConfigError without leaking the raw value when the key is not valid JSON", async () => {
    // 2026-08-16の障害再現: 不正な値（シェルコマンドの断片）がJSON.parseに渡るケース
    const leakedValue = "cd ~/kabu-ana-master && node -e garbage";
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = leakedValue;
    getAppsMock.mockReturnValue([]);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { getAdminApp, FirebaseAdminConfigError } = await loadAdminModule();

    let caught: unknown;
    try {
      getAdminApp();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(FirebaseAdminConfigError);
    expect((caught as Error).message).toBe(
      "FIREBASE_SERVICE_ACCOUNT_KEY の形式が不正です"
    );
    expect((caught as Error).message).not.toContain(leakedValue);
    expect((caught as Error).message).not.toContain("cd ~/kabu-");

    // console.errorのログにも値を出さないこと
    for (const call of consoleErrorSpy.mock.calls) {
      const serialized = call.map((arg) => String(arg)).join(" ");
      expect(serialized).not.toContain(leakedValue);
      expect(serialized).not.toContain("cd ~/kabu-");
    }

    consoleErrorSpy.mockRestore();
  });

  it("returns the existing app when firebase-admin already has an initialized app", async () => {
    const existingApp = { name: "[DEFAULT]" };
    getAppsMock.mockReturnValue([existingApp]);

    const { getAdminApp } = await loadAdminModule();

    expect(getAdminApp()).toBe(existingApp);
    expect(initializeAppMock).not.toHaveBeenCalled();
  });

  it("initializes a new app with the parsed credential when configured correctly", async () => {
    const validKey = JSON.stringify({ project_id: "demo-project" });
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = validKey;
    getAppsMock.mockReturnValue([]);
    const createdApp = { name: "[DEFAULT]" };
    initializeAppMock.mockReturnValue(createdApp);

    const { getAdminApp } = await loadAdminModule();

    expect(getAdminApp()).toBe(createdApp);
    expect(certMock).toHaveBeenCalledWith({ project_id: "demo-project" });
  });

  it("wraps initializeApp failures in FirebaseAdminConfigError with a safe message", async () => {
    const validKey = JSON.stringify({ project_id: "demo-project" });
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = validKey;
    getAppsMock.mockReturnValue([]);
    initializeAppMock.mockImplementation(() => {
      throw new Error("boom: some internal SDK detail");
    });
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { getAdminApp, FirebaseAdminConfigError } = await loadAdminModule();

    let caught: unknown;
    try {
      getAdminApp();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(FirebaseAdminConfigError);
    expect((caught as Error).message).toBe(
      "Firebase Admin SDK の初期化に失敗しました"
    );

    consoleErrorSpy.mockRestore();
  });
});
