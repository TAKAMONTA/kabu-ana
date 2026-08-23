import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const getAdminAppMock = vi.fn();
const verifyIdTokenMock = vi.fn();
const getAuthMock = vi.fn((_app?: unknown) => ({
  verifyIdToken: verifyIdTokenMock,
}));

vi.mock("@/lib/firebase/admin", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/firebase/admin")>(
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

import { isAuthError, verifyAuth } from "../verifyAuth";
import { FirebaseAdminConfigError } from "@/lib/firebase/admin";

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/test", { headers });
}

describe("verifyAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const result = await verifyAuth(makeRequest());

    expect(isAuthError(result)).toBe(true);
    const response = result as NextResponse;
    expect(response.status).toBe(401);
    expect(getAdminAppMock).not.toHaveBeenCalled();
  });

  it("returns 503 when Firebase Admin SDK has a config error (not disguised as a login problem)", async () => {
    getAdminAppMock.mockImplementation(() => {
      throw new FirebaseAdminConfigError(
        "FIREBASE_SERVICE_ACCOUNT_KEY が設定されていません"
      );
    });

    const result = await verifyAuth(
      makeRequest({ Authorization: "Bearer some-token" })
    );

    expect(isAuthError(result)).toBe(true);
    const response = result as NextResponse;
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe("認証サービスが利用できません");
    // 設定エラーの詳細（環境変数の値など）をレスポンスに含めないこと
    expect(JSON.stringify(body)).not.toContain("FIREBASE_SERVICE_ACCOUNT_KEY");
  });

  it("returns 401 when token verification fails (Admin SDK itself is healthy)", async () => {
    getAdminAppMock.mockReturnValue({ name: "[DEFAULT]" });
    verifyIdTokenMock.mockRejectedValue(new Error("invalid token"));

    const result = await verifyAuth(
      makeRequest({ Authorization: "Bearer bad-token" })
    );

    expect(isAuthError(result)).toBe(true);
    const response = result as NextResponse;
    expect(response.status).toBe(401);
  });

  it("returns the decoded token when verification succeeds", async () => {
    getAdminAppMock.mockReturnValue({ name: "[DEFAULT]" });
    verifyIdTokenMock.mockResolvedValue({ uid: "user-123" });

    const result = await verifyAuth(
      makeRequest({ Authorization: "Bearer good-token" })
    );

    expect(isAuthError(result)).toBe(false);
    if (!isAuthError(result)) {
      expect(result.uid).toBe("user-123");
    }
  });
});
