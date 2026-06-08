"use client";

import { ProvinPricingHero } from "@/components/pricing/ProvinPricingHero";
import { TP5_INLINE_CHECKOUT_SOURCE } from "@/lib/test-pricing-5-inline-checkout";

export function TestPricing5Hero() {
  return (
    <ProvinPricingHero
      checkoutSource={TP5_INLINE_CHECKOUT_SOURCE}
      sectionId="tp5-hero"
      mobileTitleId="tp5-hero-title"
      desktopTitleId="tp5-hero-title-desktop"
    />
  );
}
