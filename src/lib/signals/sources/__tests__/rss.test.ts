import { describe, expect, it } from "vitest";
import { parseRssFeed } from "../rss";

describe("RSS adapter", () => {
  it("scores keyword hits with source weight", () => {
    const items = parseRssFeed(
      `<rss><channel><item><title>Hormuz tanker disruption</title><link>https://example.com/a</link><pubDate>Fri, 08 May 2026 00:00:00 GMT</pubDate><description>OPEC+ LNG concern</description></item></channel></rss>`,
      { id: "x", name: "Source", url: "https://example.com/rss", weight: 1 }
    );
    expect(items[0].label).toBe("Critical");
    expect(items[0].matchedKeywords).toEqual(expect.arrayContaining(["Hormuz", "tanker", "OPEC+", "LNG"]));
  });
});
