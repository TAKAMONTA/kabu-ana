import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAdminAppMock } = vi.hoisted(() => ({
  getAdminAppMock: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({
  getAdminApp: getAdminAppMock,
}));

const { getFirestoreMock } = vi.hoisted(() => ({
  getFirestoreMock: vi.fn(() => ({ marker: "db" })),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: getFirestoreMock,
}));

import { FirebaseAdminConfigError } from "@/lib/firebase/admin";

import { getSignalsDb } from "../cache";

describe("getSignalsDb", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    getAdminAppMock.mockReset();
    getFirestoreMock.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("logs a fixed message and returns null when Firebase Admin config is missing", async () => {
    getAdminAppMock.mockImplementation(() => {
      throw new FirebaseAdminConfigError(
        "FIREBASE_SERVICE_ACCOUNT_KEY が設定されていません"
      );
    });

    const result = await getSignalsDb();

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [message] = consoleErrorSpy.mock.calls[0];
    expect(message).toContain("Firebase Admin SDKの設定エラー");
    expect(message).not.toContain("FIREBASE_SERVICE_ACCOUNT_KEY");
    expect(message).not.toContain("が設定されていません");
  });

  it("returns null without logging when a non-config error occurs", async () => {
    getAdminAppMock.mockImplementation(() => {
      throw new Error("network down");
    });

    const result = await getSignalsDb();

    expect(result).toBeNull();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("returns the Firestore instance when getAdminApp succeeds", async () => {
    const app = { marker: "app" };
    getAdminAppMock.mockReturnValue(app);

    const result = await getSignalsDb();

    expect(result).toEqual({ marker: "db" });
    expect(getFirestoreMock).toHaveBeenCalledWith(app);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
