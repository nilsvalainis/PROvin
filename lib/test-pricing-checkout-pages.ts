/** Testa cenu lapas ar Step 2 modal checkout plūsmu. */
export const TEST_PRICING_MODAL_CHECKOUT_PAGES = new Set([
  "home-pricing",
  "test-pricing-2",
  "test-pricing-3",
  "test-pricing-4",
  "test-pricing-5",
  "test-checkout",
]);

export function isTestPricingModalCheckoutPage(sourcePage: string): boolean {
  return TEST_PRICING_MODAL_CHECKOUT_PAGES.has(sourcePage);
}

export function testPricingCancelPath(sourcePage: string, locale = "lv"): string {
  if (sourcePage === "home-pricing") return `/${locale}?atcelts=1`;
  if (sourcePage === "test-checkout") return "/test-pricing-5?atcelts=1";
  if (sourcePage === "test-pricing") return "/test-pricing?atcelts=1";
  if (sourcePage.startsWith("test-pricing-")) return `/${sourcePage}?atcelts=1`;
  return "/test-pricing?atcelts=1";
}
