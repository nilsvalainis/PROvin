import { filledIrissListingLinks, IRISS_LISTING_LINKS_PER_SOURCE_MAX } from "@/lib/iriss-listing-link-lists";
import { isSingleVehicleListingUrl } from "@/lib/iriss-listings-ecarstrade-criteria";
import {
  clusterEcarstradeFilters,
  describeEcarstradeFilter,
  ecarstradeSearchUrl,
  fillFilterGaps,
  filterFromBrandModel,
  filterFromOrderFields,
  parseListingSearchDetailed,
  sameEcarstradeSearch,
  widenExactSearchBounds,
  type EcarstradeSearchFilter,
  type OrderSearchFields,
} from "@/lib/iriss-listings-ecarstrade-search";

/** Radars un pasūtījumi dala tos pašus sludinājumu saišu laukus. */
export type IrissEcarstradeLinkSource = {
  id: string;
  brandModel: string;
  listingLinkAuto1: readonly string[];
  listingLinkOpenline: readonly string[];
  listingLinkAutobid: readonly string[];
  listingLinkMobile: readonly string[];
  listingLinkEcarstrade: readonly string[];
} & OrderSearchFields;

export type IrissEcarstradeLinkPlan = {
  sourceUrls: string[];
  filter: EcarstradeSearchFilter;
  url: string;
  criteria: string[];
  unmapped: string[];
};

export type IrissScanEcarstradeLinkPreview = {
  id: string;
  brandModel: string;
  generated: string[];
  added: string[];
  alreadyHad: string[];
  skippedReason: string;
  plans: IrissEcarstradeLinkPlan[];
};

function sourceUrls(rec: Pick<IrissEcarstradeLinkSource, "listingLinkAuto1" | "listingLinkOpenline" | "listingLinkAutobid" | "listingLinkMobile">): string[] {
  return [
    ...filledIrissListingLinks(rec.listingLinkAuto1),
    ...filledIrissListingLinks(rec.listingLinkOpenline),
    ...filledIrissListingLinks(rec.listingLinkAutobid),
    ...filledIrissListingLinks(rec.listingLinkMobile),
  ].filter((url) => !isSingleVehicleListingUrl(url));
}

export function hasOtherAuctionListingLinks(
  rec: Pick<IrissEcarstradeLinkSource, "listingLinkAuto1" | "listingLinkOpenline" | "listingLinkAutobid" | "listingLinkMobile">,
): boolean {
  return sourceUrls(rec).length > 0;
}

function orderFieldsOf(rec: IrissEcarstradeLinkSource): OrderSearchFields {
  return {
    brandModel: rec.brandModel,
    productionYears: rec.productionYears,
    totalBudget: rec.totalBudget,
    engineType: rec.engineType,
    transmission: rec.transmission,
    bodyType: rec.bodyType,
    driveType: rec.driveType,
    seatCount: rec.seatCount,
    maxMileage: rec.maxMileage,
    preferredColors: rec.preferredColors,
    nonPreferredColors: rec.nonPreferredColors,
    equipmentRequired: rec.equipmentRequired,
    dealVat21Required: rec.dealVat21Required,
  };
}

function unmappedLines(filter: EcarstradeSearchFilter): string[] {
  return filter.unmapped.map((u) => `${u.key}=${u.value} (${u.reason})`);
}

export function planEcarstradeSearchUrls(rec: IrissEcarstradeLinkSource): IrissEcarstradeLinkPlan[] {
  const brand = rec.brandModel.trim();
  const urls = sourceUrls(rec);
  const extras = fillFilterGaps(filterFromBrandModel(brand), filterFromOrderFields(orderFieldsOf(rec)));
  const parsed = urls.map((url) => {
    const detailed = parseListingSearchDetailed(url);
    return { sourceUrl: url, filter: fillFilterGaps(detailed.filter, extras) };
  });
  const clusters = parsed.length > 0 ? clusterEcarstradeFilters(parsed) : extras.makeIds.length ? [{ filter: extras, sourceUrls: [] }] : [];
  const plans: IrissEcarstradeLinkPlan[] = [];
  const seen = new Set<string>();
  for (const cluster of clusters) {
    const filter = widenExactSearchBounds(cluster.filter);
    const url = ecarstradeSearchUrl(filter);
    if (!url) continue;
    if (seen.has(url) || plans.some((p) => sameEcarstradeSearch(p.url, url))) continue;
    seen.add(url);
    plans.push({
      sourceUrls: cluster.sourceUrls,
      filter,
      url,
      criteria: describeEcarstradeFilter(filter),
      unmapped: unmappedLines(filter),
    });
  }
  return plans;
}

export function generateEcarstradeSearchUrls(rec: IrissEcarstradeLinkSource): string[] {
  return planEcarstradeSearchUrls(rec).map((p) => p.url);
}

function previewFromPlans(
  rec: IrissEcarstradeLinkSource,
  generated: string[],
  added: string[],
  skippedReason: string,
): IrissScanEcarstradeLinkPreview {
  return {
    id: rec.id,
    brandModel: rec.brandModel,
    generated,
    added,
    alreadyHad: filledIrissListingLinks(rec.listingLinkEcarstrade),
    skippedReason,
    plans: planEcarstradeSearchUrls(rec),
  };
}

export function previewEcarstradeLinksForScan(rec: IrissEcarstradeLinkSource): IrissScanEcarstradeLinkPreview {
  const generated = generateEcarstradeSearchUrls(rec);
  const existing = filledIrissListingLinks(rec.listingLinkEcarstrade);
  const added: string[] = [];
  for (const url of generated) {
    if (existing.some((e) => sameEcarstradeSearch(e, url))) continue;
    if (added.some((e) => sameEcarstradeSearch(e, url))) continue;
    added.push(url);
  }
  const room = Math.max(0, IRISS_LISTING_LINKS_PER_SOURCE_MAX - existing.length);
  const clipped = added.slice(0, room);
  let skippedReason = "";
  if (generated.length === 0) skippedReason = "nav markas no brandModel vai Auto1/Openlane/Autobid/Mobile";
  else if (clipped.length === 0 && generated.length > 0) skippedReason = "eCarsTrade saite jau ir";
  else if (clipped.length < added.length) skippedReason = "sasniegts saišu limits";
  return previewFromPlans(rec, generated, clipped, skippedReason);
}

export function appendEcarstradeLinksToScan<T extends IrissEcarstradeLinkSource>(rec: T): { record: T; preview: IrissScanEcarstradeLinkPreview } {
  const preview = previewEcarstradeLinksForScan(rec);
  if (preview.added.length === 0) return { record: rec, preview };
  const existing = filledIrissListingLinks(rec.listingLinkEcarstrade);
  return {
    record: { ...rec, listingLinkEcarstrade: [...existing, ...preview.added] },
    preview,
  };
}

/** Idempotents: pievieno trūkstošās eCarsTrade saites, esošās neatstāj. */
export function withAutoEcarstradeLinks<T extends IrissEcarstradeLinkSource>(rec: T): T {
  return appendEcarstradeLinksToScan(rec).record;
}

/** Aizstāj esošās eCarsTrade saites ar no jauna ģenerētajiem filtriem. */
export function replaceEcarstradeLinks<T extends IrissEcarstradeLinkSource>(rec: T): { record: T; preview: IrissScanEcarstradeLinkPreview } {
  const generated = generateEcarstradeSearchUrls(rec);
  const existing = filledIrissListingLinks(rec.listingLinkEcarstrade);
  const same =
    generated.length === existing.length && generated.every((url, i) => sameEcarstradeSearch(url, existing[i] ?? ""));
  const preview = previewFromPlans(
    rec,
    generated,
    same ? [] : generated,
    generated.length === 0 ? "nav markas no brandModel vai Auto1/Openlane/Autobid/Mobile" : same ? "eCarsTrade saite jau ir aktuāla" : "",
  );
  if (same) return { record: rec, preview };
  return {
    record: { ...rec, listingLinkEcarstrade: generated.length > 0 ? generated : [""] },
    preview,
  };
}
