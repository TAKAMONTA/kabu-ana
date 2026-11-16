import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { parseSSE } from "@/lib/api/analysisStream";
import { AI_SERVICE_UNAVAILABLE_MESSAGE } from "@/lib/api/openrouterConfig";

import { POST } from "../route";

const originalKey = process.env.OPENROUTER_API_KEY;
let ipCounter = 0;

const BODY = {
  companyInfo: { name: "トヨタ自動車", symbol: "7203", market: "TYO" },
  stockData: { symbol: "7203", price: 2768, change: 1, changePercent: 1, volume: 1 },
  newsData: [],
};

function postAnalyze(body: unknown) {
  ipCounter += 1;
  return POST(
    new NextRequest("http://localhost/api/analyze", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `198.18.0.${ipCounter}`,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

function openRouterStream(lines: string[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const line of lines) controller.enqueue(encoder.encode(line));
        controller.close();
      },
    }),
    { status: 200 }
  );
}

const delta = (text: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n`;

describe("POST /api/analyze", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
  });

  it("returns 400 for invalid JSON or a body without companyInfo, without calling the AI", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const body of ["{not json", "null", {}, { companyInfo: "x" }]) {
      const response = await postAnalyze(body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "入力データが無効です" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 without env var names when the key is a placeholder", async () => {
    // .env.example の値。以前は別の綴りしか弾かず、そのまま OpenRouter に送っていた
    process.env.OPENROUTER_API_KEY = "your_openrouter_api_key_here";
    const response = await postAnalyze(BODY);
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain("OPENROUTER_API_KEY");
    expect(text).not.toContain(".env.local");
    expect(JSON.parse(text).error).toBe(AI_SERVICE_UNAVAILABLE_MESSAGE);
  });

  it("sends an error event when the stream ends without the structured JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        openRouterStream([delta("分析文だけで"), delta("JSONが無い"), "data: [DONE]\n"])
      )
    );

    const response = await postAnalyze(BODY);
    expect(response.status).toBe(200);
    const events = parseSSE(await response.text());

    expect(events.map(e => e.event)).toContain("narrative");
    expect(events.some(e => e.event === "result")).toBe(false);
    const error = events.find(e => e.event === "error");
    expect(error?.data).toContain("読み取れませんでした");
  });

  it("sends an error event (fixed text) for an OpenRouter mid-stream error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        openRouterStream([
          delta("途中まで"),
          `data: ${JSON.stringify({ error: { message: "upstream secret" } })}\n`,
        ])
      )
    );

    const text = await (await postAnalyze(BODY)).text();
    expect(text).not.toContain("upstream secret");
    expect(parseSSE(text).some(e => e.event === "error")).toBe(true);
  });

  it("maps an OpenRouter 401 before streaming to 503 (not a re-login 401)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    const response = await postAnalyze(BODY);
    expect(response.status).toBe(503);
  });
});
