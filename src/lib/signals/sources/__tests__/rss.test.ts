import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchEnergyNews, parseRssFeed, RSS_SOURCES } from "../rss";

const SOURCE = { id: "x", name: "Source", url: "https://example.com/rss", weight: 1 };

describe("RSS adapter", () => {
  it("scores keyword hits with source weight", () => {
    const items = parseRssFeed(
      `<rss><channel><item><title>Hormuz tanker disruption</title><link>https://example.com/a</link><pubDate>Fri, 08 May 2026 00:00:00 GMT</pubDate><description>OPEC+ LNG concern</description></item></channel></rss>`,
      { id: "x", name: "Source", url: "https://example.com/rss", weight: 1 }
    );
    expect(items[0].label).toBe("Critical");
    expect(items[0].matchedKeywords).toEqual(expect.arrayContaining(["Hormuz", "tanker", "OPEC+", "LNG"]));
  });

  it("adds a Japanese headline while preserving the original title", () => {
    const items = parseRssFeed(
      `<rss><channel><item><title>LNG Tanker Exits Hormuz for India for First Time Since War Began</title><link>https://example.com/b</link><pubDate>Fri, 08 May 2026 00:00:00 GMT</pubDate><description>Shipping disruption around Hormuz</description></item></channel></rss>`,
      { id: "x", name: "Source", url: "https://example.com/rss", weight: 1 }
    );

    expect(items[0].title).toBe(
      "LNG Tanker Exits Hormuz for India for First Time Since War Began"
    );
    expect(items[0].titleJa).toContain("LNG");
    expect(items[0].titleJa).toContain("ホルムズ海峡");
  });

  it("keeps the rest of the feed when one item has an unparseable date", () => {
    // 以前は new Date("not a date").toISOString() の RangeError でフィード全体を失っていた
    const items = parseRssFeed(
      `<rss><channel>
        <item><title>Broken date</title><link>https://example.com/1</link><pubDate>not a date</pubDate></item>
        <item><title>Good item</title><link>https://example.com/2</link><pubDate>Fri, 08 May 2026 00:00:00 GMT</pubDate></item>
      </channel></rss>`,
      SOURCE
    );
    expect(items.map(item => item.title)).toEqual(["Good item"]);
    expect(items[0].publishedAt).toBe("2026-05-08T00:00:00.000Z");
  });

  it("skips items without a date instead of stamping them with the current time", () => {
    // 取得時刻で埋めると、取得のたびに「直近24時間の記事」として数え直される
    const items = parseRssFeed(
      `<rss><channel><item><title>Undated item</title><link>https://example.com/3</link></item></channel></rss>`,
      SOURCE
    );
    expect(items).toEqual([]);
  });
});

describe("fetchEnergyNews", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes a timeout signal to every feed request", async () => {
    const signals: Array<AbortSignal | null | undefined> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        signals.push(init?.signal);
        return new Response(
          `<rss><channel><item><title>Hormuz tanker</title><link>https://example.com/a</link><pubDate>Fri, 08 May 2026 00:00:00 GMT</pubDate></item></channel></rss>`
        );
      })
    );

    await fetchEnergyNews();

    expect(signals).toHaveLength(RSS_SOURCES.length);
    for (const signal of signals) {
      expect(signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("throws when every feed fails, so callers keep the last good data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );

    await expect(fetchEnergyNews()).rejects.toThrow("All RSS sources failed");
  });

  it("returns items from the feeds that succeeded when only some fail", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        if (call > 1) throw new TypeError("fetch failed");
        return new Response(
          `<rss><channel><item><title>LNG tanker</title><link>https://example.com/a</link><pubDate>Fri, 08 May 2026 00:00:00 GMT</pubDate></item></channel></rss>`
        );
      })
    );

    const items = await fetchEnergyNews();
    expect(items).toHaveLength(1);
  });
});
