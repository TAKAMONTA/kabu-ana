import { describe, expect, it } from "vitest";
import { shouldShowSponsoredAds } from "../sponsoredAds";

describe("shouldShowSponsoredAds", () => {
  it("hides sponsored ads for premium users", () => {
    expect(
      shouldShowSponsoredAds({ isPremium: true, isNativeApp: false })
    ).toBe(false);
  });

  it("hides sponsored ads in native apps to avoid undeclared tracking domains", () => {
    expect(
      shouldShowSponsoredAds({ isPremium: false, isNativeApp: true })
    ).toBe(false);
  });

  it("shows sponsored ads only for free web users", () => {
    expect(
      shouldShowSponsoredAds({ isPremium: false, isNativeApp: false })
    ).toBe(true);
  });
});
