import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const analyzeFinancialsMock = vi.fn();

vi.mock("@/lib/api/openrouter", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/openrouter")>(
    "@/lib/api/openrouter"
  );
  return {
    ...actual,
    OpenRouterClient: class {
      analyzeFinancials(...args: unknown[]) {
        return analyzeFinancialsMock(...args);
      }
    },
  };
});

import { POST } from "../route";
import { AI_SERVICE_UNAVAILABLE_MESSAGE } from "@/lib/api/openrouterConfig";
import { USAGE_COUNTABLE_HEADER } from "@/lib/utils/dailyUsageLimiter";

const originalKey = process.env.OPENROUTER_API_KEY;
let ipCounter = 0;
let ip = "";

function postEvaluation(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/financial-evaluation", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

const VALID = { symbol: "7203", companyName: "トヨタ自動車", financialData: { revenue: "1" } };

describe("POST /api/financial-evaluation", () => {
  beforeEach(() => {
    ipCounter += 1;
    ip = `192.0.2.${ipCounter}`;
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    analyzeFinancialsMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
  });

  it("returns 400 for invalid JSON and for wrongly-typed EDINET data (not a TypeError 500)", async () => {
    expect((await postEvaluation("{not json")).status).toBe(400);
    const response = await postEvaluation({
      ...VALID,
      edinetExtras: { ratios: { deRatio: "1.1" } },
    });
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("expected");
    expect(analyzeFinancialsMock).not.toHaveBeenCalled();
  });

  it("returns 503 with a fixed message when OpenRouter is not configured", async () => {
    process.env.OPENROUTER_API_KEY = "your_openrouter_key_here";
    const response = await postEvaluation(VALID);
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain("OPENROUTER");
    expect(JSON.parse(text).error).toBe(AI_SERVICE_UNAVAILABLE_MESSAGE);
  });

  it("does not consume the free quota when the AI response could not be read", async () => {
    analyzeFinancialsMock.mockResolvedValue({ analysis: "x", parseFailed: true });
    for (let i = 0; i < 7; i++) {
      const response = await postEvaluation(VALID);
      expect(response.status).toBe(200);
      expect(response.headers.get(USAGE_COUNTABLE_HEADER)).toBeNull();
      // 本文はそのまま（クライアント互換）
      expect((await response.json()).analysis.parseFailed).toBe(true);
    }
  });

  it("counts successful evaluations against the free quota", async () => {
    analyzeFinancialsMock.mockResolvedValue({ analysis: "ok" });
    for (let i = 0; i < 5; i++) {
      expect((await postEvaluation(VALID)).status).toBe(200);
    }
    expect((await postEvaluation(VALID)).status).toBe(403);
  });

  it("hides internal error details", async () => {
    analyzeFinancialsMock.mockRejectedValue(new Error("internal secret-xyz"));
    const response = await postEvaluation(VALID);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret-xyz");
  });
});
