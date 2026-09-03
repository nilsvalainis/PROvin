/** Checkout source pages that use the shared test-pricing Stripe flow. */
export const TEST_PRICING_MODAL_CHECKOUT_PAGES = new Set([
  "home-pricing",
  /** Vēsturiski Stripe session avoti — cancel URL ved uz sākumu. */
  "test-pricing-5",
  "test-checkout",
]);

export function isTestPricingModalCheckoutPage(sourcePage: string): boolean {
  return TEST_PRICING_MODAL_CHECKOUT_PAGES.has(sourcePage);
}

export function testPricingCancelPath(_sourcePage: string, locale = "lv"): string {
  return `/${locale}?atcelts=1`;
}
