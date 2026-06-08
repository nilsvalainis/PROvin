"use client";

import { ProvinPricingHero } from "@/components/pricing/ProvinPricingHero";
import { HOME_PRICING_CHECKOUT_SOURCE } from "@/lib/home-pricing-checkout";

export default function HomePricingHero() {
  return (
    <ProvinPricingHero
      checkoutSource={HOME_PRICING_CHECKOUT_SOURCE}
      sectionId="home-hero"
      mobileTitleId="marketing-hero-product-title"
      desktopTitleId="marketing-hero-product-title-desktop"
    />
  );
}
