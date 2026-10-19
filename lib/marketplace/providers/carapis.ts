import { marketplaceUseFixtures } from "@/lib/marketplace/apify-client";
import { marketplaceLoadsEnabled, providerEstimate } from "@/lib/marketplace/cost-caps";
import type { ListingProvider, MarketplaceLimits, MarketplaceQuery, MarketplaceRawListing } from "@/lib/marketplace/types";

function carapisKey(): string {
  return process.env.CARAPIS_API_KEY?.trim() ?? "";
}

/** Rezerves adapteris. Bez atslēgas un bez fixtures nedara tīkla izsaukumu. */
export function createCarapisProvider(platform: "mobilede" | "autoscout24" = "mobilede"): ListingProvider {
  return {
    id: "carapis",
    platform,
    label: "Carapis",
    usdPerThousand: 0,
    isConfigured() {
      return Boolean(carapisKey()) || marketplaceUseFixtures();
    },
    buildQuery(criteria) {
      return {
        source: platform,
        make: criteria.make,
        model: criteria.model,
        year_from: criteria.yearFrom,
        year_to: criteria.yearTo,
        mileage_from: criteria.mileageFrom,
        mileage_to: criteria.mileageTo,
        price_from: criteria.priceFrom,
        price_to: criteria.priceTo,
        fuel: criteria.fuel,
        gearbox: criteria.gearbox,
        power_from: criteria.powerFromKw,
        power_to: criteria.powerToKw,
        displacement_from: criteria.displacementFromCc,
        displacement_to: criteria.displacementToCc,
        body: criteria.body,
        drive: criteria.drive,
      };
    },
    estimateCost(query, maxItems) {
      const configured = this.isConfigured();
      return providerEstimate(
        this.id,
        this.platform,
        0,
        query,
        maxItems,
        configured,
        configured ? undefined : "Nav CARAPIS_API_KEY.",
      );
    },
    async search(_query: MarketplaceQuery, _limits: MarketplaceLimits): Promise<MarketplaceRawListing[]> {
      if (!marketplaceLoadsEnabled()) return [];
      if (marketplaceUseFixtures()) return [];
      return [];
    },
  };
}
