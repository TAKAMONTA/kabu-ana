import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "../cronAuth";

const KEYS = ["CRON_SECRET", "SIGNALS_CRON_SECRET"] as const;
const original = new Map(KEYS.map(key => [key, process.env[key]]));

describe("isAuthorizedCronRequest", () => {
  beforeEach(() => {
    for (const key of KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of KEYS) {
      const value = original.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("accepts the CRON_SECRET that Vercel Cron sends as a Bearer token", () => {
    process.env.CRON_SECRET = "vercel-secret";
    expect(isAuthorizedCronRequest("Bearer vercel-secret")).toBe(true);
    expect(isAuthorizedCronRequest("Bearer wrong")).toBe(false);
    expect(isAuthorizedCronRequest("vercel-secret")).toBe(false);
    expect(isAuthorizedCronRequest(null)).toBe(false);
  });

  it("still accepts the legacy SIGNALS_CRON_SECRET", () => {
    process.env.SIGNALS_CRON_SECRET = "legacy-secret";
    expect(isAuthorizedCronRequest("Bearer legacy-secret")).toBe(true);

    process.env.CRON_SECRET = "vercel-secret";
    expect(isAuthorizedCronRequest("Bearer vercel-secret")).toBe(true);
    expect(isAuthorizedCronRequest("Bearer legacy-secret")).toBe(true);
  });

  it("rejects everything when no secret is configured", () => {
    expect(isAuthorizedCronRequest("Bearer ")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer undefined")).toBe(false);
  });
});
