import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getAdminAppMock = vi.fn();

vi.mock("@/lib/firebase/admin", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/firebase/admin")>(
      "@/lib/firebase/admin"
    );
  return {
    ...actual,
    getAdminApp: (...args: unknown[]) => getAdminAppMock(...args),
  };
});

import { checkPremiumStatus } from "../dailyUsageLimiter";
import { FirebaseAdminConfigError } from "@/lib/firebase/admin";

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/test", { headers });
}

describe("checkPremiumStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when there is no bearer token", async () => {
    const result = await checkPremiumStatus(makeRequest());
    expect(result).toBe(false);
    expect(getAdminAppMock).not.toHaveBeenCalled();
  });

  it("returns false and logs when Firebase Admin SDK has a config error (fail-closed, but traceable)", async () => {
    getAdminAppMock.mockImplementation(() => {
      throw new FirebaseAdminConfigError(
        "FIREBASE_SERVICE_ACCOUNT_KEY が設定されていません"
      );
    });
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await checkPremiumStatus(
      makeRequest({ authorization: "Bearer some-token" })
    );

    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedMessages = consoleErrorSpy.mock.calls.map((call) =>
      call.join(" ")
    );
    expect(
      loggedMessages.some((message) => message.includes("Firebase Admin"))
    ).toBe(true);

    consoleErrorSpy.mockRestore();
  });
});
