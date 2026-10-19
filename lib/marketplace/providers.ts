import { createApifyAutoscout24Provider } from "@/lib/marketplace/providers/apify-autoscout24";
import { createApifyMobiledeProvider } from "@/lib/marketplace/providers/apify-mobilede";
import { createCarapisProvider } from "@/lib/marketplace/providers/carapis";
import type { ListingProvider, MarketplacePlatform, MarketplaceProviderId } from "@/lib/marketplace/types";

function envChoice(name: string, fallback: string): string {
  return (process.env[name]?.trim() || fallback).toLowerCase();
}

export function marketplaceProviderForPlatform(platform: MarketplacePlatform): ListingProvider {
  if (platform === "mobilede") {
    const choice = envChoice("MARKETPLACE_PROVIDER_MOBILEDE", "apify");
    if (choice === "carapis") return createCarapisProvider("mobilede");
    return createApifyMobiledeProvider();
  }
  const choice = envChoice("MARKETPLACE_PROVIDER_AUTOSCOUT24", "apify");
  if (choice === "carapis") return createCarapisProvider("autoscout24");
  return createApifyAutoscout24Provider();
}

export function marketplaceProviders(ids?: readonly MarketplaceProviderId[]): ListingProvider[] {
  const wanted = ids?.length ? ids : (["apify-mobilede", "apify-autoscout24"] as const);
  const out: ListingProvider[] = [];
  const seen = new Set<string>();
  for (const id of wanted) {
    const platform = id === "apify-autoscout24" ? "autoscout24" : "mobilede";
    const provider = id === "carapis" ? createCarapisProvider(platform) : marketplaceProviderForPlatform(platform);
    if (seen.has(provider.id + provider.platform)) continue;
    seen.add(provider.id + provider.platform);
    out.push(provider);
  }
  return out;
}

export const MARKETPLACE_PLATFORM_LABEL: Record<MarketplacePlatform, string> = {
  mobilede: "mobile.de",
  autoscout24: "AutoScout24",
};
