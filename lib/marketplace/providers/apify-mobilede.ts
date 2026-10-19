import {
  marketplaceActorId,
  marketplaceApifySearchPayload,
  marketplaceUseFixtures,
  readApifyToken,
  runMarketplaceApifyActor,
} from "@/lib/marketplace/apify-client";
import { marketplaceLoadsEnabled, marketplaceMaxItemsPerProvider, providerEstimate } from "@/lib/marketplace/cost-caps";
import { marketplaceActorSearchInput } from "@/lib/marketplace/search-urls";
import type { ListingProvider } from "@/lib/marketplace/types";
import type { MarketplaceLimits, MarketplaceQuery, MarketplaceRawListing } from "@/lib/marketplace/types";

export const APIFY_MOBILEDE_USD_PER_THOUSAND = 0.8;

const FIXTURES: MarketplaceRawListing[] = [
  {
    externalId: "md-1001",
    url: "https://suchen.mobile.de/fahrzeuge/details.html?id=1001",
    title: "Volvo XC60 D4 Momentum",
    make: "Volvo",
    model: "XC60",
    year: "2019",
    mileageKm: 98000,
    priceEur: 18900,
    fuel: "Diesel",
    gearbox: "Automatic",
    powerKw: 140,
    countryCode: "DE",
    description: "must not store",
    images: ["https://example.com/a.jpg"],
    sellerPhone: "+49 111",
    sellerEmail: "seller@example.com",
  },
  {
    externalId: "md-1002",
    url: "https://suchen.mobile.de/fahrzeuge/details.html?id=1002",
    title: "Volvo XC60 T5",
    make: "Volvo",
    model: "XC60",
    year: "2018",
    mileageKm: 121000,
    priceEur: 16450,
    fuel: "Petrol",
    gearbox: "Automatic",
    powerKw: 187,
    countryCode: "DE",
  },
];

export function createApifyMobiledeProvider(): ListingProvider {
  return {
    id: "apify-mobilede",
    platform: "mobilede",
    label: "mobile.de",
    usdPerThousand: APIFY_MOBILEDE_USD_PER_THOUSAND,
    isConfigured() {
      return Boolean(readApifyToken() && marketplaceActorId("MARKETPLACE_APIFY_MOBILEDE_ACTOR")) || marketplaceUseFixtures();
    },
    buildQuery(criteria) {
      return marketplaceActorSearchInput("mobilede", criteria, { maxItems: marketplaceMaxItemsPerProvider() });
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
        configured ? undefined : readApifyToken() ? "Nav MARKETPLACE_APIFY_MOBILEDE_ACTOR." : "Nav APIFY_TOKEN.",
      );
    },
    async search(query: MarketplaceQuery, limits: MarketplaceLimits): Promise<MarketplaceRawListing[]> {
      if (!marketplaceLoadsEnabled()) return [];
      if (marketplaceUseFixtures()) return FIXTURES.slice(0, limits.maxItems);
      const actorId = marketplaceActorId("MARKETPLACE_APIFY_MOBILEDE_ACTOR");
      const run = await runMarketplaceApifyActor({
        actorId,
        payload: marketplaceApifySearchPayload(
          marketplaceActorSearchInput("mobilede", query, limits),
          limits,
        ),
        maxItems: limits.maxItems,
        maxUsd: limits.maxUsd,
      });
      if (!run.ok) return [];
      return run.items.filter((x): x is MarketplaceRawListing => Boolean(x) && typeof x === "object");
    },
  };
}
