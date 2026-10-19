import {
  marketplaceActorId,
  marketplaceApifySearchPayload,
  marketplaceUseFixtures,
  readApifyToken,
  runMarketplaceApifyActor,
} from "@/lib/marketplace/apify-client";
import { marketplaceMaxItemsPerProvider, providerEstimate } from "@/lib/marketplace/cost-caps";
import type { ListingProvider, MarketplaceLimits, MarketplaceQuery, MarketplaceRawListing } from "@/lib/marketplace/types";

export const APIFY_AUTOSCOUT24_USD_PER_THOUSAND = 0.5;

const FIXTURES: MarketplaceRawListing[] = [
  {
    externalId: "as-2001",
    url: "https://www.autoscout24.com/offers/volvo-xc60-2001",
    title: "Volvo XC60 D4 AWD",
    make: "Volvo",
    model: "XC60",
    year: "2019",
    mileageKm: 97500,
    priceEur: 19200,
    fuel: "Diesel",
    gearbox: "Automatic",
    powerKw: 140,
    countryCode: "DE",
    description: "drop me",
    sellerName: "Hans",
  },
  {
    externalId: "as-2002",
    url: "https://www.autoscout24.de/angebote/volvo-xc60-2002",
    title: "Volvo XC60 Inscription",
    make: "Volvo",
    model: "XC60",
    year: "2020",
    mileageKm: 72000,
    priceEur: 23900,
    fuel: "Diesel",
    gearbox: "Automatic",
    powerKw: 140,
    countryCode: "AT",
  },
];

export function createApifyAutoscout24Provider(): ListingProvider {
  return {
    id: "apify-autoscout24",
    platform: "autoscout24",
    label: "AutoScout24",
    usdPerThousand: APIFY_AUTOSCOUT24_USD_PER_THOUSAND,
    isConfigured() {
      return Boolean(readApifyToken() && marketplaceActorId("MARKETPLACE_APIFY_AUTOSCOUT24_ACTOR")) || marketplaceUseFixtures();
    },
    buildQuery(criteria) {
      return {
        make: criteria.make,
        model: criteria.model,
        yearFrom: criteria.yearFrom,
        yearTo: criteria.yearTo,
        mileageFrom: criteria.mileageFrom,
        mileageTo: criteria.mileageTo,
        priceFrom: criteria.priceFrom,
        priceTo: criteria.priceTo,
        fuel: criteria.fuel,
        gearbox: criteria.gearbox,
        maxItems: marketplaceMaxItemsPerProvider(),
      };
    },
    estimateCost(query, maxItems) {
      const configured = this.isConfigured();
      return providerEstimate(
        this.id,
        this.platform,
        this.usdPerThousand,
        query,
        maxItems,
        configured,
        configured ? undefined : readApifyToken() ? "Nav MARKETPLACE_APIFY_AUTOSCOUT24_ACTOR." : "Nav APIFY_TOKEN.",
      );
    },
    async search(query: MarketplaceQuery, limits: MarketplaceLimits): Promise<MarketplaceRawListing[]> {
      if (marketplaceUseFixtures()) return FIXTURES.slice(0, limits.maxItems);
      const actorId = marketplaceActorId("MARKETPLACE_APIFY_AUTOSCOUT24_ACTOR");
      const run = await runMarketplaceApifyActor({
        actorId,
        payload: marketplaceApifySearchPayload(this.buildQuery(query), limits),
        maxItems: limits.maxItems,
        maxUsd: limits.maxUsd,
      });
      if (!run.ok) return [];
      return run.items.filter((x): x is MarketplaceRawListing => Boolean(x) && typeof x === "object");
    },
  };
}
