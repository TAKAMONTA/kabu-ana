import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appleSubscriptionStatusToSubscriptionStatus,
  buildSubscriptionDocumentFromVerification,
  isAllowedNativeProduct,
  parseNativePurchaseUpdateRequest,
  PURCHASE_VERIFICATION_UNAVAILABLE_MESSAGE,
  PurchaseVerificationError,
  type NativePurchaseUpdateRequest,
  type VerifiedNativePurchase,
  verifyNativePurchase,
} from "../nativePurchaseVerification";

const ENV_KEYS = [
  "APP_STORE_CONNECT_KEY_ID",
  "APP_STORE_CONNECT_ISSUER_ID",
  "APP_STORE_CONNECT_PRIVATE_KEY",
  "IOS_BUNDLE_ID",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_KEY",
  "GOOGLE_PLAY_PACKAGE_NAME",
] as const;

const originalEnv = new Map(
  ENV_KEYS.map((key) => [key, process.env[key]])
);

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function base64Url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signedAppleTransaction(payload: Record<string, unknown>): string {
  return [
    base64Url(JSON.stringify({ alg: "ES256" })),
    base64Url(JSON.stringify(payload)),
    base64Url("signature"),
  ].join(".");
}

function setAppleEnv() {
  const { privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  process.env.APP_STORE_CONNECT_KEY_ID = "apple-key-id";
  process.env.APP_STORE_CONNECT_ISSUER_ID = "apple-issuer-id";
  process.env.APP_STORE_CONNECT_PRIVATE_KEY = privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString();
  process.env.IOS_BUNDLE_ID = "com.takaapps.kabunavi";
}

function setGoogleEnv() {
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY = JSON.stringify({
    type: "service_account",
    client_email: "billing-verifier@example.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  });
  process.env.GOOGLE_PLAY_PACKAGE_NAME = "app.vercel.kabu_9t7mdgybz_takamontas_projects.twa";
}

describe("native purchase verification", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    restoreEnv();
  });

  it("builds subscription state from store verification, not client supplied status", () => {
    const request: NativePurchaseUpdateRequest = {
      idToken: "firebase-token",
      platform: "ios",
      productId: "com.takaapps.kabunavi.Monthly",
      purchaseToken: "client-transaction-id",
      status: "active",
      expiryDate: "2099-01-01T00:00:00.000Z",
    };
    const verified: VerifiedNativePurchase = {
      platform: "ios",
      productId: "com.takaapps.kabunavi.Monthly",
      purchaseToken: "verified-transaction-id",
      originalTransactionId: "original-transaction-id",
      status: "expired",
      expiryDate: "2024-01-01T00:00:00.000Z",
      isTrial: false,
      raw: { source: "test" },
    };

    const document = buildSubscriptionDocumentFromVerification(
      "user-123",
      request,
      verified
    );

    expect(document.status).toBe("expired");
    expect(document.expiryDate).toEqual(new Date("2024-01-01T00:00:00.000Z"));
    expect(document.purchaseToken).toBe("verified-transaction-id");
    expect(document.orderId).toBe("original-transaction-id");
  });

  it("omits an undefined expiry date from the Firestore subscription document", () => {
    const request: NativePurchaseUpdateRequest = {
      idToken: "firebase-token",
      platform: "ios",
      productId: "com.takaapps.kabunavi.Monthly",
      purchaseToken: "client-transaction-id",
    };
    const verified: VerifiedNativePurchase = {
      platform: "ios",
      productId: "com.takaapps.kabunavi.Monthly",
      purchaseToken: "verified-transaction-id",
      status: "active",
      isTrial: false,
      raw: { source: "test" },
    };

    const document = buildSubscriptionDocumentFromVerification(
      "user-123",
      request,
      verified
    );

    expect(Object.hasOwn(document, "expiryDate")).toBe(false);
  });

  it("allows only configured native product identifiers for each platform", () => {
    expect(isAllowedNativeProduct("ios", "com.takaapps.kabunavi.Monthly")).toBe(true);
    expect(isAllowedNativeProduct("ios", "premium_monthly")).toBe(false);
    expect(isAllowedNativeProduct("android", "premium_monthly")).toBe(true);
  });

  it("signs App Store Server API JWTs with raw ES256 signatures", async () => {
    setAppleEnv();
    let authorizationHeader = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        authorizationHeader = String(
          (init?.headers as Record<string, string>)?.Authorization || ""
        );
        return new Response(
          JSON.stringify({
            signedTransactionInfo: signedAppleTransaction({
              bundleId: "com.takaapps.kabunavi",
              productId: "com.takaapps.kabunavi.Monthly",
              transactionId: "1000000000000001",
              purchaseDate: "1779552000000",
              expiresDate: "1782230400000",
            }),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );

    const request = parseNativePurchaseUpdateRequest({
      idToken: "firebase-token",
      platform: "ios",
      productId: "com.takaapps.kabunavi.Monthly",
      purchaseToken: "1000000000000001",
    });

    await verifyNativePurchase(request);

    const signature = Buffer.from(
      authorizationHeader.replace("Bearer ", "").split(".")[2],
      "base64url"
    );
    expect(signature).toHaveLength(64);
  });

  it("keeps a Google Play canceled subscription active until its expiry time", async () => {
    setGoogleEnv();
    vi.setSystemTime(new Date("2026-05-24T00:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "https://oauth2.googleapis.com/token") {
          return new Response(JSON.stringify({ access_token: "google-token" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            subscriptionState: "SUBSCRIPTION_STATE_CANCELED",
            latestOrderId: "GPA.1234-5678-9012-34567",
            startTime: "2026-05-01T00:00:00Z",
            lineItems: [
              {
                productId: "premium_monthly",
                expiryTime: "2026-06-01T00:00:00Z",
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );

    const request = parseNativePurchaseUpdateRequest({
      idToken: "firebase-token",
      platform: "android",
      productId: "premium_monthly",
      purchaseToken: "play-purchase-token",
    });

    const verified = await verifyNativePurchase(request);

    expect(verified.status).toBe("active");
    expect(verified.expiryDate).toBe("2026-06-01T00:00:00Z");
  });

  it("maps App Store status codes (1 active, 2 expired, 3 billing retry, 4 grace period, 5 revoked)", () => {
    const future = "2099-01-01T00:00:00.000Z";
    const past = "2020-01-01T00:00:00.000Z";
    expect(appleSubscriptionStatusToSubscriptionStatus(1, future)).toBe("active");
    expect(appleSubscriptionStatusToSubscriptionStatus(2, past)).toBe("expired");
    expect(appleSubscriptionStatusToSubscriptionStatus(3, past)).toBe("pending");
    // 請求猶予期間は取引の期限が過ぎていても利用継続（以前は expired になっていた）
    expect(appleSubscriptionStatusToSubscriptionStatus(4, past)).toBe("active");
    expect(appleSubscriptionStatusToSubscriptionStatus(5, future)).toBe("cancelled");
  });

  it("keeps an App Store subscription in billing grace period active until gracePeriodExpiresDate", async () => {
    setAppleEnv();
    vi.setSystemTime(new Date("2026-05-24T00:00:00.000Z"));
    const transaction = {
      bundleId: "com.takaapps.kabunavi",
      productId: "com.takaapps.kabunavi.Monthly",
      transactionId: "1000000000000002",
      originalTransactionId: "1000000000000001",
      purchaseDate: String(Date.parse("2026-04-20T00:00:00.000Z")),
      // 取引の期限は過ぎている
      expiresDate: String(Date.parse("2026-05-20T00:00:00.000Z")),
    };
    const gracePeriodExpiresDate = Date.parse("2026-06-05T00:00:00.000Z");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/inApps/v1/subscriptions/")) {
          return Response.json({
            data: [
              {
                lastTransactions: [
                  {
                    status: 4,
                    originalTransactionId: "1000000000000001",
                    signedTransactionInfo: signedAppleTransaction(transaction),
                    signedRenewalInfo: signedAppleTransaction({
                      originalTransactionId: "1000000000000001",
                      gracePeriodExpiresDate,
                    }),
                  },
                ],
              },
            ],
          });
        }
        return Response.json({
          signedTransactionInfo: signedAppleTransaction(transaction),
        });
      })
    );

    const verified = await verifyNativePurchase(
      parseNativePurchaseUpdateRequest({
        idToken: "firebase-token",
        platform: "ios",
        productId: "com.takaapps.kabunavi.Monthly",
        purchaseToken: "1000000000000002",
      })
    );

    expect(verified.status).toBe("active");
    expect(verified.expiryDate).toBe(new Date(gracePeriodExpiresDate).toISOString());
  });

  it("returns a generic 503 (no env var names) when App Store credentials are missing", async () => {
    delete process.env.APP_STORE_CONNECT_KEY_ID;
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const attempt = verifyNativePurchase(
      parseNativePurchaseUpdateRequest({
        idToken: "firebase-token",
        platform: "ios",
        productId: "com.takaapps.kabunavi.Monthly",
        purchaseToken: "1000000000000001",
      })
    );

    await expect(attempt).rejects.toBeInstanceOf(PurchaseVerificationError);
    await expect(attempt).rejects.toMatchObject({
      statusCode: 503,
      message: PURCHASE_VERIFICATION_UNAVAILABLE_MESSAGE,
    });
    const error = await attempt.catch((e: Error) => e);
    expect((error as Error).message).not.toContain("APP_STORE_CONNECT");
    expect(fetchSpy).not.toHaveBeenCalled();
    // 詳細はサーバーログ側にだけ残る
    expect(
      consoleErrorSpy.mock.calls.some(call =>
        String(call[0]).includes("APP_STORE_CONNECT_KEY_ID")
      )
    ).toBe(true);
    consoleErrorSpy.mockRestore();
  });

  it("does not echo Apple's raw error body when the transaction is not found", async () => {
    setAppleEnv();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { errorCode: 4040010, errorMessage: "Transaction id not found." },
          { status: 404 }
        )
      )
    );

    const error = await verifyNativePurchase(
      parseNativePurchaseUpdateRequest({
        idToken: "firebase-token",
        platform: "ios",
        productId: "com.takaapps.kabunavi.Monthly",
        purchaseToken: "1000000000000001",
      })
    ).catch((e: PurchaseVerificationError) => e);

    expect(error).toBeInstanceOf(PurchaseVerificationError);
    expect((error as PurchaseVerificationError).statusCode).toBe(404);
    expect((error as Error).message).not.toContain("4040010");
    expect((error as Error).message).not.toContain("errorMessage");
    consoleErrorSpy.mockRestore();
  });

  it("maps an App Store 401 (our credentials) to 503 instead of a login-style 401", async () => {
    setAppleEnv();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({}, { status: 401 }))
    );

    const error = await verifyNativePurchase(
      parseNativePurchaseUpdateRequest({
        idToken: "firebase-token",
        platform: "ios",
        productId: "com.takaapps.kabunavi.Monthly",
        purchaseToken: "1000000000000001",
      })
    ).catch((e: PurchaseVerificationError) => e);

    expect((error as PurchaseVerificationError).statusCode).toBe(503);
    expect((error as Error).message).toBe(PURCHASE_VERIFICATION_UNAVAILABLE_MESSAGE);
    consoleErrorSpy.mockRestore();
  });

  it("passes a timeout signal to store API requests", async () => {
    setGoogleEnv();
    const signals: Array<AbortSignal | null | undefined> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        signals.push(init?.signal);
        if (url === "https://oauth2.googleapis.com/token") {
          return Response.json({ access_token: "google-token" });
        }
        return Response.json({
          subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
          lineItems: [
            { productId: "premium_monthly", expiryTime: "2099-01-01T00:00:00Z" },
          ],
        });
      })
    );

    await verifyNativePurchase(
      parseNativePurchaseUpdateRequest({
        idToken: "firebase-token",
        platform: "android",
        productId: "premium_monthly",
        purchaseToken: "play-purchase-token",
      })
    );

    expect(signals).toHaveLength(2);
    for (const signal of signals) {
      expect(signal).toBeInstanceOf(AbortSignal);
    }
  });
});
