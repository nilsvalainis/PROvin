/** Testa cenu lapas ar Step 2 modal checkout plūsmu. */
export const TEST_PRICING_MODAL_CHECKOUT_PAGES = new Set([
  "test-pricing-2",
  "test-pricing-3",
  "test-pricing-4",
]);

export function isTestPricingModalCheckoutPage(sourcePage: string): boolean {
  return TEST_PRICING_MODAL_CHECKOUT_PAGES.has(sourcePage);
}

export function testPricingCancelPath(sourcePage: string): string {
  if (sourcePage === "test-pricing") return "/test-pricing?atcelts=1";
  if (sourcePage.startsWith("test-pricing-")) return `/${sourcePage}?atcelts=1`;
  return "/test-pricing?atcelts=1";
}
