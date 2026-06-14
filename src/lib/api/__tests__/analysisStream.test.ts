import { describe, expect, it } from "vitest";
import {
  STRUCTURED_JSON_SENTINEL,
  formatSSE,
  parseSSE,
  splitNarrativeAndJson,
} from "../analysisStream";
import { buildAnalysisPrompt } from "../openrouter";

describe("STRUCTURED_JSON_SENTINEL", () => {
  it("is imported from analysisStream and matches what the prompt contains", () => {
    const prompt = buildAnalysisPrompt(
      { name: "テスト企業", symbol: "TEST", market: "東証" },
      { price: 1000, change: 10, changePercent: 1 },
      [],
      true
    );
    expect(prompt).toContain(STRUCTURED_JSON_SENTINEL);
  });
});

describe("splitNarrativeAndJson", () => {
  it("splits on sentinel", () => {
    const json = '{"investmentAdvice":"test"}';
    const full = `所見テキスト\n${STRUCTURED_JSON_SENTINEL}\n${json}`;
    const result = splitNarrativeAndJson(full);
    expect(result.narrative).toBe("所見テキスト");
    expect(result.json).toBe(json);
  });

  it("falls back to first brace when no sentinel", () => {
    const json = '{"investmentAdvice":"fallback"}';
    const full = `所見テキスト\n${json}`;
    const result = splitNarrativeAndJson(full);
    expect(result.narrative).toBe("所見テキスト");
    expect(result.json).toBe(json);
  });

  it("returns null json when no JSON present", () => {
    const result = splitNarrativeAndJson("所見だけのテキスト");
    expect(result.narrative).toBe("所見だけのテキスト");
    expect(result.json).toBeNull();
  });
});

describe("formatSSE / parseSSE round-trip", () => {
  it("round-trips a simple narrative event", () => {
    const frame = formatSSE("narrative", "hello");
    const events = parseSSE(frame);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("narrative");
    expect(events[0].data).toBe("hello");
  });

  it("round-trips narrative with newlines", () => {
    const text = "line1\nline2\nline3";
    const frame = formatSSE("narrative", text);
    const events = parseSSE(frame);
    expect(events[0].data).toBe(text);
  });

  it("parses multiple concatenated events", () => {
    const buf =
      formatSSE("narrative", "chunk1") +
      formatSSE("narrative", "chunk2") +
      formatSSE("result", '{"investmentAdvice":"done"}');
    const events = parseSSE(buf);
    expect(events).toHaveLength(3);
    expect(events[2].event).toBe("result");
  });

  it("ignores incomplete frame at end of buffer", () => {
    const complete = formatSSE("narrative", "complete");
    const partial = "event: narrative\ndata: incomplete";
    const events = parseSSE(complete + partial);
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe("complete");
  });

  it("round-trips a result payload with newlines so it stays valid JSON", () => {
    // result data is itself JSON.stringify output; if a string field contains a
    // newline, a naive \n unescape corrupts it and JSON.parse throws on the client.
    const obj = { aiReflection: "1行目\n2行目", investmentAdvice: 'コメント"引用"' };
    const frame = formatSSE("result", JSON.stringify(obj));
    const events = parseSSE(frame);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("result");
    expect(JSON.parse(events[0].data)).toEqual(obj);
  });
});
