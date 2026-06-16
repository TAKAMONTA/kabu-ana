import { describe, expect, it } from "vitest";
import {
  getLatestBriefSourceAt,
  hasBriefSourceData,
  shouldUseCachedBrief,
  type BriefSourceInput,
} from "../briefCache";

describe("brief cache freshness", () => {
  it("detects the newest timestamp across brief source payloads", () => {
    const input: BriefSourceInput = {
      prices: { fetchedAt: "2026-06-16T09:42:09.799Z", prices: [] },
      news: { fetchedAt: "2026-06-16T09:42:11.688Z", items: [] },
      seismic: { fetchedAt: "2026-06-16T09:42:10.839Z", earthquakes: [] },
      risk: { calculatedAt: "2026-06-16T09:42:09.021Z" },
    };

    expect(getLatestBriefSourceAt(input)).toBe("2026-06-16T09:42:11.688Z");
  });

  it("does not reuse a brief generated before newer source data arrived", () => {
    const input: BriefSourceInput = {
      news: { fetchedAt: "2026-06-16T09:42:11.688Z", items: [] },
    };

    expect(
      shouldUseCachedBrief({ generatedAt: "2026-06-16T09:41:51.604Z" }, input)
    ).toBe(false);
  });

  it("reuses a brief generated after the latest source data", () => {
    const input: BriefSourceInput = {
      news: { fetchedAt: "2026-06-16T09:42:11.688Z", items: [] },
    };

    expect(
      shouldUseCachedBrief({ generatedAt: "2026-06-16T09:45:00.000Z" }, input)
    ).toBe(true);
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
});
