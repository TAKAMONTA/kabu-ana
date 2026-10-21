import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getAdminAppMock = vi.fn();
const verifyIdTokenMock = vi.fn();
const getAuthMock = vi.fn((_app?: unknown) => ({
  verifyIdToken: verifyIdTokenMock,
}));

vi.mock("@/lib/firebase/admin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/firebase/admin")>(
    "@/lib/firebase/admin"
  );
  return {
    ...actual,
    getAdminApp: () => getAdminAppMock(),
  };
});

vi.mock("firebase-admin/auth", () => ({
  getAuth: (app: unknown) => getAuthMock(app),
}));

vi.mock("@/lib/utils/rateLimiter", () => ({
  withRateLimit: (handler: (request: NextRequest) => Promise<Response>) =>
    handler,
}));

import { POST } from "../route";
import { FirebaseAdminConfigError } from "@/lib/firebase/admin";

function postClaudeBrief(headers: Record<string, string> = {}) {
  const request = new NextRequest("http://localhost/api/signals/claude-brief", {
    method: "POST",
    headers,
  });
  return POST(request);
}

describe("POST /api/signals/claude-brief", () => {
  const originalExportStatic = process.env.EXPORT_STATIC;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.EXPORT_STATIC;
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    if (originalExportStatic === undefined) {
      delete process.env.EXPORT_STATIC;
    } else {
      process.env.EXPORT_STATIC = originalExportStatic;
    }
  });

  it("returns 503 without disguising a Firebase Admin config error as a login problem", async () => {
    getAdminAppMock.mockImplementation(() => {
      throw new FirebaseAdminConfigError(
        "FIREBASE_SERVICE_ACCOUNT_KEY が設定されていません"
      );
    });

    const response = await postClaudeBrief({ Authorization: "Bearer x" });

    expect(response.status).toBe(503);
    const bodyText = await response.text();
    expect(bodyText).not.toContain("ログイン");
    expect(JSON.parse(bodyText)).toEqual({
      error: "認証サービスが利用できません",
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "verifyAuth: Firebase Admin SDKの設定エラー"
    );
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const response = await postClaudeBrief();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "認証が必要です。ログインしてください。" });
    expect(getAdminAppMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the ID token fails verification (Admin SDK itself is healthy)", async () => {
    getAdminAppMock.mockReturnValue({ name: "[DEFAULT]" });
    verifyIdTokenMock.mockRejectedValue(new Error("invalid token"));

    const response = await postClaudeBrief({
      Authorization: "Bearer bad-token",
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({
      error: "認証に失敗しました。再ログインしてください。",
    });
  });
});
