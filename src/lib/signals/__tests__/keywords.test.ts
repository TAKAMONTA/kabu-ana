import { describe, expect, it } from "vitest";
import { calculateKeywordWeight, findKeywordMatches } from "../keywords";

describe("signal keywords", () => {
  it("matches Japanese and English weighted keywords", () => {
    const text = "ホルムズでtanker混乱、OPEC+も協議";
    expect(findKeywordMatches(text).map((item) => item.keyword)).toEqual(expect.arrayContaining(["ホルムズ", "tanker", "OPEC+"]));
    expect(calculateKeywordWeight(text)).toBeGreaterThanOrEqual(7.5);
  });
});
