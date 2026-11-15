import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AI_ANALYSIS_FAILED_MESSAGE,
  AI_SERVICE_UNAVAILABLE_MESSAGE,
  AI_TIMEOUT_MESSAGE,
  AiServiceError,
  OpenRouterClient,
  type StreamTimeouts,
} from "../openrouter";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** OpenRouter の SSE を模したストリーム。chunks の間に delayMs 待つ */
function sseResponse(chunks: string[], delayMs = 0, stallAfter?: number) {
  const encoder = new TextEncoder();
  let index = 0;
  return new Response(
    new ReadableStream({
      async pull(controller) {
        if (stallAfter !== undefined && index >= stallAfter) {
          await sleep(10_000); // 応答が止まる
          return;
        }
        if (index >= chunks.length) {
          controller.close();
          return;
        }
        if (delayMs) await sleep(delayMs);
        controller.enqueue(encoder.encode(chunks[index++]));
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } }
  );
}

const delta = (text: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n`;

async function collect(
  timeouts: StreamTimeouts,
  response: Response | (() => Promise<Response>)
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const r = typeof response === "function" ? await response() : response;
      // AbortSignal が渡されていることを確認しつつ、中断時は例外にする
      init?.signal?.throwIfAborted();
      return r;
    })
  );
  const client = new OpenRouterClient("sk-or-test");
  const out: string[] = [];
  for await (const chunk of client.analyzeStockStream(
    { name: "Example", symbol: "EX" },
    { price: 1 },
    [],
    undefined,
    undefined,
    timeouts
  )) {
    out.push(chunk);
  }
  return out.join("");
}

describe("OpenRouterClient.analyzeStockStream", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lets a long generation finish as long as chunks keep arriving", async () => {
    // 接続30秒の単一タイムアウトだと、長い生成が途中で切れていた
    const chunks = Array.from({ length: 10 }, (_, i) => delta(`${i}`));
    const text = await collect(
      { connectMs: 40, idleMs: 60, totalMs: 2000 },
      sseResponse([...chunks, "data: [DONE]\n"], 20)
    );
    expect(text).toBe("0123456789");
  });

  it("aborts when the stream goes idle", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const attempt = collect(
      { connectMs: 1000, idleMs: 50, totalMs: 5000 },
      sseResponse([delta("a"), delta("b")], 0, 1)
    );
    await expect(attempt).rejects.toMatchObject({
      status: 504,
      message: AI_TIMEOUT_MESSAGE,
    });
  });

  it("enforces an overall cap even if chunks keep trickling in", async () => {
    const chunks = Array.from({ length: 50 }, () => delta("x"));
    await expect(
      collect({ connectMs: 1000, idleMs: 1000, totalMs: 150 }, sseResponse(chunks, 20))
    ).rejects.toMatchObject({ status: 504 });
  });

  it("turns an OpenRouter mid-stream error chunk into an error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const attempt = collect(
      { connectMs: 1000, idleMs: 1000, totalMs: 5000 },
      sseResponse([
        delta("partial"),
        `data: ${JSON.stringify({ error: { code: 502, message: "provider exploded: secret" } })}\n`,
      ])
    );
    await expect(attempt).rejects.toBeInstanceOf(AiServiceError);
    await expect(attempt).rejects.toMatchObject({
      message: AI_ANALYSIS_FAILED_MESSAGE,
    });
  });

  it("maps 401 (our key) to a generic 503 instead of a login-style 401", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      collect(
        { connectMs: 1000, idleMs: 1000, totalMs: 5000 },
        new Response("{}", { status: 401 })
      )
    ).rejects.toMatchObject({ status: 503, message: AI_SERVICE_UNAVAILABLE_MESSAGE });
  });

  it("hides raw network errors such as 'fetch failed'", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );
    const client = new OpenRouterClient("sk-or-test");
    const generator = client.analyzeStockStream({}, {}, []);
    await expect(generator.next()).rejects.toMatchObject({
      status: 502,
      message: AI_ANALYSIS_FAILED_MESSAGE,
    });
  });
});
