import { b2bDemoTenantDir } from "@/lib/b2b-demo-paths";

export type MarketplaceTenantScope = { kind: "iriss" } | { kind: "b2b"; tenantId: string };

export const IRISS_MARKETPLACE_STORAGE_PREFIX = "iriss-marketplace/";

export function marketplaceStoragePrefix(scope: MarketplaceTenantScope = { kind: "iriss" }): string {
  if (scope.kind === "b2b") return `${b2bDemoTenantDir(scope.tenantId)}/marketplace/`;
  return IRISS_MARKETPLACE_STORAGE_PREFIX;
}

export function marketplaceListingsFile(scope?: MarketplaceTenantScope): string {
  return `${marketplaceStoragePrefix(scope)}listings.json`;
}

export function marketplaceUsageFile(month: string, scope?: MarketplaceTenantScope): string {
  return `${marketplaceStoragePrefix(scope)}usage-${month}.json`;
}

export function marketplaceAutoCronFile(scope?: MarketplaceTenantScope): string {
  return `${marketplaceStoragePrefix(scope)}auto-cron.json`;
}
