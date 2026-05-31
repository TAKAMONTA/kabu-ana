interface SponsoredAdsVisibilityInput {
  isPremium: boolean;
  isNativeApp: boolean;
}

export function shouldShowSponsoredAds({
  isPremium,
  isNativeApp,
}: SponsoredAdsVisibilityInput): boolean {
  return !isPremium && !isNativeApp;
}
