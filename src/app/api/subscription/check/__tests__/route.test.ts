import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getAdminAppMock = vi.fn();

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

import { GET } from "../route";
import { FirebaseAdminConfigError } from "@/lib/firebase/admin";

function getSubscriptionCheck(headers: Record<string, string> = {}) {
  const request = new NextRequest("http://localhost/api/subscription/check", {
    method: "GET",
    headers,
  });
  return GET(request);
}

describe("GET /api/subscription/check", () => {
  it("returns 400 when no idToken is provided (header or query param)", async () => {
    const response = await getSubscriptionCheck();

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("idTokenが必要です");
    expect(getAdminAppMock).not.toHaveBeenCalled();
  });

  it("returns 503 without leaking the config error detail when Firebase Admin SDK is misconfigured", async () => {
    // 2026-08-16の障害再現: JSON.parseの失敗が本文にそのまま漏れていたパターン
    const leakedValue = "cd ~/kabu-ana-master && node -e garbage";
    getAdminAppMock.mockImplementation(() => {
      throw new FirebaseAdminConfigError(
        "FIREBASE_SERVICE_ACCOUNT_KEY の形式が不正です"
      );
    });

    const response = await getSubscriptionCheck({
      Authorization: "Bearer smoke-check-invalid-token",
    });

    expect(response.status).toBe(503);
    const bodyText = await response.text();
    expect(bodyText).not.toContain(leakedValue);
    expect(bodyText).not.toContain("FIREBASE_SERVICE_ACCOUNT_KEY");
    const body = JSON.parse(bodyText);
    expect(body.error).toBe("認証サービスが利用できません");
  });
});
