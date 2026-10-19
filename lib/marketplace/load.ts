import { assignMarketplaceGroupIds } from "@/lib/marketplace/dedupe";
import {
  decideMarketplaceBudget,
  marketplaceAutoMaxItemsPerProvider,
  marketplaceAutoMonthlyUsdCap,
  MARKETPLACE_LOADS_DISABLED_REASON,
  marketplaceLoadsEnabled,
  MARKETPLACE_RUNS_KEEP,
  marketplaceMaxItemsPerProvider,
  marketplaceMonthKey,
  marketplaceMonthlyUsdCap,
  usageSpentUsd,
  usageSpentUsdByTrigger,
} from "@/lib/marketplace/cost-caps";
import { normalizeMarketplaceListings } from "@/lib/marketplace/normalize";
import { attachMarketplacePriceCompare } from "@/lib/marketplace/price-compare";
import { marketplaceProviders } from "@/lib/marketplace/providers";
import {
  marketplaceQueryFromOrder,
  marketplaceOrderHasFetchBounds,
  marketplaceExtraRangeMissing,
  marketplaceStrictMissingFields,
  type MarketplaceOrderCriteria,
} from "@/lib/marketplace/query-from-order";
import {
  readMarketplaceListingsState,
  readMarketplaceUsageMonth,
  writeMarketplaceListingsState,
  writeMarketplaceUsageMonth,
} from "@/lib/marketplace/store";
import { marketplaceListingExpiresAt, marketplaceListingVehicleId } from "@/lib/marketplace/to-listing-vehicle";
import {
  MARKETPLACE_TOO_BROAD_ERROR,
  MARKETPLACE_TTL_DAYS,
  type ListingProvider,
  type MarketplaceLoadResult,
  type MarketplaceLoadTrigger,
  type MarketplacePlatform,
  type MarketplaceProviderId,
  type MarketplaceQuery,
  type MarketplaceRunRecord,
  type MarketplaceStoredListing,
} from "@/lib/marketplace/types";

export type MarketplaceLoadInput = {
  orderId: string;
  order: MarketplaceOrderCriteria;
  platforms?: MarketplacePlatform[];
  maxItems?: number;
  sortNewest?: boolean;
  /** auto: cron. manual: tikai pēc pogas (explicit: true). */
  trigger?: MarketplaceLoadTrigger;
  /** Manuālajai ielādei obligāti true. Cron to nesūta. */
  explicit?: boolean;
  now?: string;
  providers?: ListingProvider[];
};

function platformsToProviderIds(platforms: readonly MarketplacePlatform[] | undefined): MarketplaceProviderId[] {
  if (!platforms?.length) return ["apify-mobilede", "apify-autoscout24"];
  return platforms.map((p) => (p === "autoscout24" ? "apify-autoscout24" : "apify-mobilede"));
}

export function estimateMarketplaceLoad(input: {
  order: MarketplaceOrderCriteria;
  platforms?: MarketplacePlatform[];
  maxItems?: number;
  providers?: ListingProvider[];
}) {
  const query = marketplaceQueryFromOrder(input.order);
  const maxItems = input.maxItems ?? marketplaceMaxItemsPerProvider();
  const providers = input.providers ?? marketplaceProviders(platformsToProviderIds(input.platforms));
  const estimates = providers.map((p) => p.estimateCost(query, maxItems));
  return { query, maxItems, providers, estimates };
}

export async function previewMarketplaceLoad(input: {
  order: MarketplaceOrderCriteria;
  platforms?: MarketplacePlatform[];
  maxItems?: number;
  providers?: ListingProvider[];
}) {
  const preview = estimateMarketplaceLoad(input);
  const usage = await readMarketplaceUsageMonth();
  const budget = decideMarketplaceBudget({ estimates: preview.estimates, usage });
  return {
    ...preview,
    budget,
    queryReady: marketplaceOrderHasFetchBounds(input.order),
    missingFields: marketplaceStrictMissingFields(input.order),
    needsOneOfExtra: marketplaceExtraRangeMissing(input.order),
    usageMonth: usage.month,
  };
}

function storedFromNormalized(
  item: ReturnType<typeof attachMarketplacePriceCompare<ReturnType<typeof assignMarketplaceGroupIds>[number]>>[number],
  orderId: string,
): MarketplaceStoredListing {
  return {
    ...item,
    id: marketplaceListingVehicleId(item.platform, item.externalId),
    orderId,
    tenantScope: "iriss",
    expiresAt: marketplaceListingExpiresAt(item.fetchedAt, MARKETPLACE_TTL_DAYS),
  };
}

function mergeStored(previous: readonly MarketplaceStoredListing[], incoming: readonly MarketplaceStoredListing[]): MarketplaceStoredListing[] {
  const map = new Map<string, MarketplaceStoredListing>();
  for (const item of previous) map.set(`${item.orderId}|${item.platform}|${item.externalId}`, item);
  for (const item of incoming) map.set(`${item.orderId}|${item.platform}|${item.externalId}`, item);
  return [...map.values()];
}

function resolveLoadTrigger(input: MarketplaceLoadInput): MarketplaceLoadTrigger {
  return input.trigger === "auto" ? "auto" : "manual";
}

/**
 * Manuāli: tikai pēc pogas (explicit: true). Auto: tikai no cron sweep.
 */
export async function loadMarketplaceForOrder(input: MarketplaceLoadInput): Promise<MarketplaceLoadResult> {
  const trigger = resolveLoadTrigger(input);
  if (trigger === "manual" && input.explicit !== true) {
    return { ok: false, blocked: true, error: "explicit_required", added: 0, grouped: 0, estimatedUsd: 0, remainingMonthlyUsd: 0 };
  }
  const orderId = input.orderId.trim();
  if (!orderId) {
    return { ok: false, error: "order_required", added: 0, grouped: 0, estimatedUsd: 0, remainingMonthlyUsd: 0 };
  }
  if (!marketplaceOrderHasFetchBounds(input.order)) {
    return {
      ok: false,
      blocked: true,
      error: MARKETPLACE_TOO_BROAD_ERROR,
      missingFields: marketplaceStrictMissingFields(input.order),
      needsOneOfExtra: marketplaceExtraRangeMissing(input.order),
      added: 0,
      grouped: 0,
      estimatedUsd: 0,
      remainingMonthlyUsd: 0,
    };
  }
  if (!marketplaceLoadsEnabled()) {
    return {
      ok: false,
      blocked: true,
      error: MARKETPLACE_LOADS_DISABLED_REASON,
      added: 0,
      grouped: 0,
      estimatedUsd: 0,
      remainingMonthlyUsd: 0,
      chargedUsd: 0,
      monthlyUsedUsd: 0,
    };
  }
  const maxItems =
    input.maxItems ?? (trigger === "auto" ? marketplaceAutoMaxItemsPerProvider() : marketplaceMaxItemsPerProvider());
  const preview = await previewMarketplaceLoad({ ...input, maxItems });
  if (!preview.budget.allowed) {
    return {
      ok: false,
      blocked: true,
      error: preview.budget.reason,
      added: 0,
      grouped: 0,
      estimatedUsd: preview.budget.estimatedUsd,
      remainingMonthlyUsd: preview.budget.remainingMonthlyUsd,
    };
  }
  if (trigger === "auto") {
    const autoCap = marketplaceAutoMonthlyUsdCap();
    const autoUsed = usageSpentUsdByTrigger(await readMarketplaceUsageMonth(marketplaceMonthKey(new Date(input.now ?? Date.now()))), "auto");
    const remainingAuto = Math.round((autoCap - autoUsed) * 1000) / 1000;
    if (preview.budget.estimatedUsd > remainingAuto + 1e-9) {
      return {
        ok: false,
        blocked: true,
        error: "budžets sasniegts",
        added: 0,
        grouped: 0,
        estimatedUsd: preview.budget.estimatedUsd,
        remainingMonthlyUsd: preview.budget.remainingMonthlyUsd,
      };
    }
  }
  const unconfigured = preview.estimates.filter((e) => !e.configured);
  if (unconfigured.length === preview.estimates.length) {
    return {
      ok: false,
      blocked: true,
      error: unconfigured[0]?.reason || "token_missing",
      added: 0,
      grouped: 0,
      estimatedUsd: preview.budget.estimatedUsd,
      remainingMonthlyUsd: preview.budget.remainingMonthlyUsd,
    };
  }

  const now = input.now ?? new Date().toISOString();
  const startedAt = now;
  const query: MarketplaceQuery = preview.query;
  const collected = [];
  let chargedUsd = 0;
  const notes: string[] = [];
  const apifyRunIds: string[] = [];
  const providerCharges: Array<{ providerId: MarketplaceProviderId; usd: number; items: number }> = [];
  for (const provider of preview.providers) {
    const estimate = preview.estimates.find((e) => e.providerId === provider.id && e.platform === provider.platform);
    if (!estimate?.configured) {
      notes.push(`${provider.label}: ${estimate?.reason || "nav konfigurēts"}`);
      continue;
    }
    try {
      const found = await provider.search(query, {
        maxItems: preview.maxItems,
        maxUsd: preview.budget.perRunCapUsd,
        ...(input.sortNewest ? { sortNewest: true } : {}),
      });
      const actual = Number.isFinite(found.chargedUsd) ? found.chargedUsd : 0;
      chargedUsd += actual;
      if (found.apifyRunId?.trim()) apifyRunIds.push(found.apifyRunId.trim());
      const normalized = normalizeMarketplaceListings(provider.platform, provider.id, found.items, now);
      collected.push(...normalized);
      providerCharges.push({
        providerId: provider.id,
        usd: actual,
        items: normalized.length,
      });
      console.info("[marketplace]", {
        provider: provider.id,
        apifyRunId: found.apifyRunId ?? "",
        status: found.error ? "failed" : "ok",
        items: normalized.length,
        chargedUsd: actual,
      });
      if (found.error) notes.push(found.error);
    } catch (e) {
      notes.push(`${provider.label}: ${e instanceof Error ? e.message : "kļūda"}`);
    }
  }

  const grouped = assignMarketplaceGroupIds(collected);
  const compared = attachMarketplacePriceCompare(grouped);
  const stored = compared.map((item) => storedFromNormalized(item, orderId));
  const previous = await readMarketplaceListingsState();
  const nextItems = mergeStored(previous.items, stored);
  const runId = `mkt-${now.replace(/[:.]/g, "-")}-${orderId.slice(0, 8)}`;
  const usage = await readMarketplaceUsageMonth(marketplaceMonthKey(new Date(now)));
  usage.capUsd = marketplaceMonthlyUsdCap();
  let monthUsd = usageSpentUsd(usage);
  const chargedRounded = Math.round(chargedUsd * 1000) / 1000;
  for (const charge of providerCharges) {
    monthUsd = Math.round((monthUsd + charge.usd) * 1000) / 1000;
    usage.entries.push({
      runId,
      orderId,
      providerId: charge.providerId,
      items: stored.filter((s) => s.providerId === charge.providerId).length,
      usd: charge.usd,
      monthUsd,
      at: now,
      trigger,
    });
  }
  const run: MarketplaceRunRecord = {
    id: runId,
    orderId,
    tenantScope: "iriss",
    providers: preview.providers.map((p) => p.id),
    query,
    maxItems: preview.maxItems,
    maxUsd: preview.budget.perRunCapUsd,
    estimatedUsd: preview.budget.estimatedUsd,
    chargedUsd: chargedRounded,
    monthUsd,
    itemCount: collected.length,
    keptCount: stored.length,
    rejectedCount: Math.max(0, collected.length - stored.length),
    startedAt,
    finishedAt: new Date().toISOString(),
    status: stored.length > 0 ? (notes.length ? "partial" : "ok") : notes.length ? "failed" : "ok",
    trigger,
    note: notes.join(" "),
    apifyRunIds,
  };
  const write = await writeMarketplaceListingsState({
    version: 1,
    updatedAt: run.finishedAt,
    items: nextItems,
    runs: [...previous.runs, run].slice(-MARKETPLACE_RUNS_KEEP),
  });
  if (!write.ok) {
    return {
      ok: false,
      error: write.error,
      added: 0,
      grouped: 0,
      estimatedUsd: preview.budget.estimatedUsd,
      remainingMonthlyUsd: preview.budget.remainingMonthlyUsd,
    };
  }

  await writeMarketplaceUsageMonth(usage);

  const groupCount = new Set(stored.map((s) => s.groupId)).size;
  const failed = run.status === "failed";
  return {
    ok: !failed,
    ...(notes.length ? { error: notes.join(" ") } : {}),
    run,
    added: stored.length,
    grouped: stored.length - groupCount,
    estimatedUsd: preview.budget.estimatedUsd,
    chargedUsd: chargedRounded,
    monthlyUsedUsd: monthUsd,
    remainingMonthlyUsd: Math.round((preview.budget.remainingMonthlyUsd - chargedUsd) * 1000) / 1000,
  };
}
