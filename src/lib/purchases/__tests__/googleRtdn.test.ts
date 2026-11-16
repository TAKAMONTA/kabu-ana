import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdTokenMock = vi.fn();
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken(options: unknown) {
      return verifyIdTokenMock(options);
    }
  },
}));

import {
  parsePubSubPush,
  readRtdnAuthConfig,
  RtdnAuthError,
  RtdnConfigError,
  RtdnPayloadError,
  verifyPubSubPushToken,
} from "../googleRtdn";

const config = {
  audience: "https://example.test/api/google/rtdn",
  serviceAccountEmail: "rtdn-push@project.iam.gserviceaccount.com",
};

function ticket(payload: Record<string, unknown>) {
  return { getPayload: () => payload };
}

describe("verifyPubSubPushToken", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
  });

  it("accepts a token for the configured audience and service account", async () => {
    verifyIdTokenMock.mockResolvedValue(
      ticket({ email: config.serviceAccountEmail, email_verified: true })
    );
    await expect(verifyPubSubPushToken("Bearer token-1", config)).resolves.toBeUndefined();
    expect(verifyIdTokenMock).toHaveBeenCalledWith({
      idToken: "token-1",
      audience: config.audience,
    });
  });

  it("rejects a missing or non-Bearer Authorization header", async () => {
    await expect(verifyPubSubPushToken(null, config)).rejects.toBeInstanceOf(RtdnAuthError);
    await expect(verifyPubSubPushToken("Basic abc", config)).rejects.toBeInstanceOf(
      RtdnAuthError
    );
    expect(verifyIdTokenMock).not.toHaveBeenCalled();
  });

  it("rejects a token that fails signature / audience verification", async () => {
    verifyIdTokenMock.mockRejectedValue(new Error("Wrong recipient, payload audience != requiredAudience"));
    await expect(verifyPubSubPushToken("Bearer token-1", config)).rejects.toBeInstanceOf(
      RtdnAuthError
    );
  });

  it("rejects a token from another service account or with an unverified email", async () => {
    verifyIdTokenMock.mockResolvedValue(
      ticket({ email: "attacker@example.com", email_verified: true })
    );
    await expect(verifyPubSubPushToken("Bearer token-1", config)).rejects.toBeInstanceOf(
      RtdnAuthError
    );
    verifyIdTokenMock.mockResolvedValue(
      ticket({ email: config.serviceAccountEmail, email_verified: false })
    );
    await expect(verifyPubSubPushToken("Bearer token-1", config)).rejects.toBeInstanceOf(
      RtdnAuthError
    );
  });
});

describe("readRtdnAuthConfig", () => {
  it("requires both the audience and the service account email", () => {
    vi.stubEnv("GOOGLE_RTDN_PUSH_AUDIENCE", "");
    vi.stubEnv("GOOGLE_RTDN_PUSH_SERVICE_ACCOUNT_EMAIL", config.serviceAccountEmail);
    expect(() => readRtdnAuthConfig()).toThrow(RtdnConfigError);
    vi.stubEnv("GOOGLE_RTDN_PUSH_AUDIENCE", config.audience);
    vi.stubEnv("GOOGLE_RTDN_PUSH_SERVICE_ACCOUNT_EMAIL", "");
    expect(() => readRtdnAuthConfig()).toThrow(RtdnConfigError);
    vi.stubEnv("GOOGLE_RTDN_PUSH_SERVICE_ACCOUNT_EMAIL", config.serviceAccountEmail);
    expect(readRtdnAuthConfig()).toEqual(config);
    vi.unstubAllEnvs();
  });
});

describe("parsePubSubPush", () => {
  const notification = {
    version: "1.0",
    packageName: "com.example.app",
    eventTimeMillis: "1503349568000",
    subscriptionNotification: {
      version: "1.0",
      notificationType: 2,
      purchaseToken: "purchase-token",
    },
  };

  it("decodes message.data (base64 JSON)", () => {
    const parsed = parsePubSubPush({
      message: {
        data: Buffer.from(JSON.stringify(notification)).toString("base64"),
        messageId: "136969346945",
        publishTime: "2026-11-16T00:00:00.000Z",
      },
      subscription: "projects/p/subscriptions/s",
    });
    expect(parsed).toEqual({ messageId: "136969346945", notification });
  });

  it("rejects malformed pushes", () => {
    expect(() => parsePubSubPush(null)).toThrow(RtdnPayloadError);
    expect(() => parsePubSubPush({ message: { data: "e30=" } })).toThrow(RtdnPayloadError);
    expect(() =>
      parsePubSubPush({ message: { messageId: "1", data: "not base64 json" } })
    ).toThrow(RtdnPayloadError);
  });
});
