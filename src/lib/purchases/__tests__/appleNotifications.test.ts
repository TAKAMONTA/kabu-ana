import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  APPLE_ROOT_CA_G3_SHA256,
  AppleNotificationConfigError,
  AppleNotificationVerificationError,
  appleRootCertificates,
  peekNotificationEnvironment,
  verifyAppleNotification,
} from "../appleNotifications";

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function unsignedJws(payload: unknown, header: unknown = { alg: "ES256" }): string {
  return `${b64url(header)}.${b64url(payload)}.c2ln`;
}

/**
 * x5c に本物の Apple Root CA - G3 を並べ、手元の鍵で署名した偽の通知。
 * 証明書チェーン（葉 → 中間 → ルート）の署名が成り立たないので検証に失敗するべき。
 */
function forgedNotification(environment = "Sandbox"): string {
  const rootBase64 = appleRootCertificates()[0].toString("base64");
  const header = { alg: "ES256", x5c: [rootBase64, rootBase64, rootBase64] };
  const payload = {
    notificationType: "DID_RENEW",
    notificationUUID: "uuid-forged",
    signedDate: Date.now(),
    data: { bundleId: "com.takaapps.kabunavi", environment, appAppleId: 123 },
  };
  const signingInput = `${b64url(header)}.${b64url(payload)}`;
  const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const signature = crypto
    .createSign("SHA256")
    .update(signingInput)
    .sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${signature.toString("base64url")}`;
}

describe("appleRootCertificates", () => {
  it("embeds the Apple Root CA - G3 certificate (pinned SHA-256 fingerprint)", () => {
    const [der] = appleRootCertificates();
    const certificate = new crypto.X509Certificate(der);
    expect(certificate.subject).toContain("CN=Apple Root CA - G3");
    expect(certificate.checkIssued(certificate)).toBe(true);
    expect(crypto.createHash("sha256").update(der).digest("hex")).toBe(
      APPLE_ROOT_CA_G3_SHA256
    );
  });
});

describe("peekNotificationEnvironment", () => {
  it("reads Production / Sandbox from data.environment", () => {
    expect(peekNotificationEnvironment(unsignedJws({ data: { environment: "Production" } }))).toBe(
      "Production"
    );
    expect(peekNotificationEnvironment(unsignedJws({ data: { environment: "Sandbox" } }))).toBe(
      "Sandbox"
    );
  });

  it("rejects Xcode / LocalTesting notifications (their signature is not verified)", () => {
    for (const environment of ["Xcode", "LocalTesting", undefined]) {
      expect(() =>
        peekNotificationEnvironment(unsignedJws({ data: { environment } }))
      ).toThrow(AppleNotificationVerificationError);
    }
  });

  it("rejects a payload that is not a JWS", () => {
    expect(() => peekNotificationEnvironment("not-a-jws")).toThrow(
      AppleNotificationVerificationError
    );
    expect(() => peekNotificationEnvironment("a.%%%.c")).toThrow(
      AppleNotificationVerificationError
    );
  });
});

describe("verifyAppleNotification", () => {
  const config = {
    bundleId: "com.takaapps.kabunavi",
    appAppleId: 123,
    enableOnlineChecks: false,
  };

  it("rejects a notification whose certificate chain is not signed by Apple", async () => {
    await expect(
      verifyAppleNotification(forgedNotification("Sandbox"), config)
    ).rejects.toBeInstanceOf(AppleNotificationVerificationError);
    await expect(
      verifyAppleNotification(forgedNotification("Production"), config)
    ).rejects.toBeInstanceOf(AppleNotificationVerificationError);
  });

  it("rejects an unsigned notification", async () => {
    await expect(
      verifyAppleNotification(
        unsignedJws({ data: { environment: "Sandbox", bundleId: "com.takaapps.kabunavi" } }),
        config
      )
    ).rejects.toBeInstanceOf(AppleNotificationVerificationError);
  });

  it("requires APP_STORE_APP_APPLE_ID for production notifications", async () => {
    await expect(
      verifyAppleNotification(forgedNotification("Production"), {
        ...config,
        appAppleId: undefined,
      })
    ).rejects.toBeInstanceOf(AppleNotificationConfigError);
  });
});
