import {
  marketplaceActorId,
  marketplaceApifySearchPayload,
  marketplaceSourceErrorNote,
  marketplaceUseFixtures,
  readApifyToken,
  runMarketplaceApifyActor,
} from "@/lib/marketplace/apify-client";
import { marketplaceLoadsEnabled, marketplaceMaxItemsPerProvider, providerEstimate } from "@/lib/marketplace/cost-caps";
import { marketplaceActorSearchInput } from "@/lib/marketplace/search-urls";
import type {
  ListingProvider,
  MarketplaceLimits,
  MarketplaceQuery,
  MarketplaceRawListing,
  MarketplaceSearchResult,
} from "@/lib/marketplace/types";

export const APIFY_AUTOSCOUT24_USD_PER_THOUSAND = 0.49;

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
      return marketplaceActorSearchInput("autoscout24", criteria, { maxItems: marketplaceMaxItemsPerProvider() });
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
    async search(query: MarketplaceQuery, limits: MarketplaceLimits): Promise<MarketplaceSearchResult> {
      if (!marketplaceLoadsEnabled()) return { items: [], chargedUsd: 0 };
      if (marketplaceUseFixtures()) return { items: FIXTURES.slice(0, limits.maxItems), chargedUsd: 0 };
      const actorId = marketplaceActorId("MARKETPLACE_APIFY_AUTOSCOUT24_ACTOR");
      const run = await runMarketplaceApifyActor({
        actorId,
        payload: marketplaceApifySearchPayload(
          marketplaceActorSearchInput("autoscout24", query, limits),
          limits,
        ),
        maxItems: limits.maxItems,
        maxUsd: limits.maxUsd,
        usdPerThousand: APIFY_AUTOSCOUT24_USD_PER_THOUSAND,
      });
      const items = run.items.filter((x): x is MarketplaceRawListing => Boolean(x) && typeof x === "object");
      if (!run.ok) {
        return {
          items,
          chargedUsd: run.chargedUsd,
          error: marketplaceSourceErrorNote(this.label, run.error),
          ...(run.apifyRunId ? { apifyRunId: run.apifyRunId } : {}),
        };
      }
      return { items, chargedUsd: run.chargedUsd, ...(run.apifyRunId ? { apifyRunId: run.apifyRunId } : {}) };
    },
  };
}
