import { filledIrissListingLinks, IRISS_LISTING_LINKS_PER_SOURCE_MAX } from "@/lib/iriss-listing-link-lists";
import {
  ecarstradeSearchUrl,
  fillMakeModelFromBrand,
  filterFromBrandModel,
  mergeEcarstradeFilters,
  parseListingSearchUrl,
  sameEcarstradeSearch,
  type EcarstradeSearchFilter,
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
};

export type IrissScanEcarstradeLinkPreview = {
  id: string;
  brandModel: string;
  generated: string[];
  added: string[];
  alreadyHad: string[];
  skippedReason: string;
};

function sourceUrls(rec: Pick<IrissEcarstradeLinkSource, "listingLinkAuto1" | "listingLinkOpenline" | "listingLinkAutobid" | "listingLinkMobile">): string[] {
  return [
    ...filledIrissListingLinks(rec.listingLinkAuto1),
    ...filledIrissListingLinks(rec.listingLinkOpenline),
    ...filledIrissListingLinks(rec.listingLinkAutobid),
    ...filledIrissListingLinks(rec.listingLinkMobile),
  ];
}

export function hasOtherAuctionListingLinks(
  rec: Pick<IrissEcarstradeLinkSource, "listingLinkAuto1" | "listingLinkOpenline" | "listingLinkAutobid" | "listingLinkMobile">,
): boolean {
  return sourceUrls(rec).length > 0;
}

function mergedFilterForRecord(
  rec: Pick<IrissEcarstradeLinkSource, "brandModel" | "listingLinkAuto1" | "listingLinkOpenline" | "listingLinkAutobid" | "listingLinkMobile">,
): EcarstradeSearchFilter | null {
  const brand = rec.brandModel.trim();
  const urls = sourceUrls(rec);
  let merged = filterFromBrandModel(brand);
  for (const url of urls) {
    merged = mergeEcarstradeFilters(merged, fillMakeModelFromBrand(parseListingSearchUrl(url), brand));
  }
  return merged.makeIds.length ? merged : null;
}

export function generateEcarstradeSearchUrls(
  rec: Pick<IrissEcarstradeLinkSource, "brandModel" | "listingLinkAuto1" | "listingLinkOpenline" | "listingLinkAutobid" | "listingLinkMobile">,
): string[] {
  const filter = mergedFilterForRecord(rec);
  if (!filter) return [];
  const url = ecarstradeSearchUrl(filter);
  return url ? [url] : [];
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
  return {
    id: rec.id,
    brandModel: rec.brandModel,
    generated,
    added: clipped,
    alreadyHad: existing,
    skippedReason,
  };
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

/** Aizstāj esošās eCarsTrade saites ar no jauna ģenerēto filtru. */
export function replaceEcarstradeLinks<T extends IrissEcarstradeLinkSource>(rec: T): { record: T; preview: IrissScanEcarstradeLinkPreview } {
  const generated = generateEcarstradeSearchUrls(rec);
  const existing = filledIrissListingLinks(rec.listingLinkEcarstrade);
  const same =
    generated.length === existing.length && generated.every((url, i) => sameEcarstradeSearch(url, existing[i] ?? ""));
  const preview: IrissScanEcarstradeLinkPreview = {
    id: rec.id,
    brandModel: rec.brandModel,
    generated,
    added: same ? [] : generated,
    alreadyHad: existing,
    skippedReason: generated.length === 0 ? "nav markas no brandModel vai Auto1/Openlane/Autobid/Mobile" : same ? "eCarsTrade saite jau ir aktuāla" : "",
  };
  if (same) return { record: rec, preview };
  return {
    record: { ...rec, listingLinkEcarstrade: generated.length > 0 ? generated : [""] },
    preview,
  };
}
