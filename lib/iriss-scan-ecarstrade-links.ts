import { filledIrissListingLinks, IRISS_LISTING_LINKS_PER_SOURCE_MAX } from "@/lib/iriss-listing-link-lists";
import { isMobileDeListingUrl, isSingleVehicleListingUrl } from "@/lib/iriss-listings-ecarstrade-criteria";
import {
  applyEcarstradeOrderCriteria,
  describeEcarstradeFilter,
  ecarstradeSearchUrl,
  fillMissingModelFromBrand,
  filterFromOrderFields,
  parseListingSearchDetailed,
  sameEcarstradeSearch,
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
  /** true, ja listingLinkEcarstrade mainās (arī kad formas ET jānokasa). */
  changed: boolean;
};

function isAuctionSearchUrl(url: string): boolean {
  return !isSingleVehicleListingUrl(url) && !isMobileDeListingUrl(url);
}

/** Tikai Auto1 / Autobid / Openlane. Mobile.de (Pasūtījumi un Radars) ET neģenerē. */
function sourceUrls(
  rec: Pick<IrissEcarstradeLinkSource, "listingLinkAuto1" | "listingLinkOpenline" | "listingLinkAutobid">,
): string[] {
  return [
    ...filledIrissListingLinks(rec.listingLinkAuto1),
    ...filledIrissListingLinks(rec.listingLinkOpenline),
    ...filledIrissListingLinks(rec.listingLinkAutobid),
  ].filter(isAuctionSearchUrl);
}

export function hasOtherAuctionListingLinks(
  rec: Pick<IrissEcarstradeLinkSource, "listingLinkAuto1" | "listingLinkOpenline" | "listingLinkAutobid" | "listingLinkMobile">,
): boolean {
  return sourceUrls(rec).length > 0;
}

function unmappedLines(filter: EcarstradeSearchFilter): string[] {
  return filter.unmapped.map((u) => `${u.key}=${u.value} (${u.reason})`);
}

const NO_AUCTION_ET_REASON = "nav izsoles saites ar marku (Auto1/Openlane/Autobid)";

/** Izsoles URL marka un modelis. Gadi, km, cena, degviela un kārba arī no pasūtījuma, ja izsole tos nesatur vai ir platāka. */
function filterFromAuctionUrl(url: string, rec: IrissEcarstradeLinkSource): EcarstradeSearchFilter {
  const parsed = parseListingSearchDetailed(url).filter;
  if (!parsed.makeIds.length) return parsed;
  const withModel = fillMissingModelFromBrand(parsed, rec.brandModel.trim());
  return applyEcarstradeOrderCriteria(withModel, filterFromOrderFields(rec));
}

export function planEcarstradeSearchUrls(rec: IrissEcarstradeLinkSource): IrissEcarstradeLinkPlan[] {
  const parsed = sourceUrls(rec)
    .map((url) => ({
      sourceUrl: url,
      filter: filterFromAuctionUrl(url, rec),
    }))
    .filter((row) => row.filter.makeIds.length > 0);
  const clusters = parsed.map((row) => ({ filter: row.filter, sourceUrls: [row.sourceUrl] }));
  const plans: IrissEcarstradeLinkPlan[] = [];
  const seen = new Set<string>();
  for (const cluster of clusters) {
    const filter = cluster.filter;
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
  changed: boolean,
): IrissScanEcarstradeLinkPreview {
  return {
    id: rec.id,
    brandModel: rec.brandModel,
    generated,
    added,
    alreadyHad: filledIrissListingLinks(rec.listingLinkEcarstrade),
    skippedReason,
    plans: planEcarstradeSearchUrls(rec),
    changed,
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
  if (generated.length === 0) skippedReason = NO_AUCTION_ET_REASON;
  else if (clipped.length === 0 && generated.length > 0) skippedReason = "eCarsTrade saite jau ir";
  else if (clipped.length < added.length) skippedReason = "sasniegts saišu limits";
  return previewFromPlans(rec, generated, clipped, skippedReason, clipped.length > 0);
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
    generated.length === 0 ? NO_AUCTION_ET_REASON : same ? "eCarsTrade saite jau ir aktuāla" : "",
    !same,
  );
  if (same) return { record: rec, preview };
  return {
    record: { ...rec, listingLinkEcarstrade: generated.length > 0 ? generated : [""] },
    preview,
  };
}
