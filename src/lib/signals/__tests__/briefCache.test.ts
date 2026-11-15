import { describe, expect, it } from "vitest";
import {
  BRIEF_GENERATING_STALE_MS,
  decideBriefGeneration,
  hasBriefSourceData,
  isBriefReady,
  MAX_BRIEF_ATTEMPTS_PER_DAY,
  mergeBriefSourceFallbacks,
  type BriefSourceInput,
} from "../briefCache";

describe("brief generation (once per JST day)", () => {
  const NOW = Date.parse("2026-11-15T00:00:00.000Z");
  const READY = {
    brief: { headline_jp: "見出し" },
    generatedAt: "2026-11-14T21:00:00.000Z",
  };

  it("never regenerates once today's brief exists, even if source data is newer", () => {
    // 以前は news/prices の fetchedAt がブリーフより新しいだけで再生成していた
    expect(decideBriefGeneration(READY, NOW, true)).toEqual({ kind: "ready" });
    expect(
      decideBriefGeneration({ ...READY, status: "ready", attempts: 1 }, NOW, true)
    ).toEqual({ kind: "ready" });
    expect(isBriefReady(READY)).toBe(true);
  });

  it("acquires the first attempt when nothing exists for today", () => {
    expect(decideBriefGeneration(undefined, NOW, true)).toEqual({
      kind: "acquire",
      attempts: 1,
    });
  });

  it("waits while another request is generating, but takes over a stale lock", () => {
    expect(
      decideBriefGeneration(
        { status: "generating", attempts: 1, lockedAtMs: NOW - 1000 },
        NOW,
        true
      )
    ).toEqual({ kind: "generating" });
    expect(
      decideBriefGeneration(
        {
          status: "generating",
          attempts: 1,
          lockedAtMs: NOW - BRIEF_GENERATING_STALE_MS - 1,
        },
        NOW,
        true
      )
    ).toEqual({ kind: "acquire", attempts: 2 });
  });

  it("stops after the daily attempt limit", () => {
    expect(
      decideBriefGeneration(
        { status: "error", attempts: MAX_BRIEF_ATTEMPTS_PER_DAY },
        NOW,
        true
      )
    ).toEqual({ kind: "exhausted" });
  });

  it("does not take the lock when the AI is not configured", () => {
    expect(decideBriefGeneration(undefined, NOW, false)).toEqual({
      kind: "unconfigured",
    });
  });

  it("knows whether useful source data exists before generating a brief", () => {
    expect(hasBriefSourceData({})).toBe(false);
    expect(
      hasBriefSourceData({
        news: { fetchedAt: "2026-06-16T09:42:11.688Z", items: [{ score: 5 }] },
      })
    ).toBe(true);
    expect(
      hasBriefSourceData({
        prices: { fetchedAt: "2026-06-16T09:42:09.799Z", prices: [{}] },
      })
    ).toBe(true);
  });

  it("uses freshly fetched source payloads when persisted source docs are empty", () => {
    const persisted: BriefSourceInput = {};
    const fetched: BriefSourceInput = {
      news: { fetchedAt: "2026-06-16T09:52:00.000Z", items: [{ score: 5 }] },
    };

    expect(mergeBriefSourceFallbacks(persisted, fetched)).toEqual(fetched);
  });
});
